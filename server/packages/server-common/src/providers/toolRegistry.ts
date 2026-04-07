import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { injectable } from "inversify";
import {
  CachedToolEntry,
  CachedToolInfo,
  ParsedToolJson,
  PopulateCacheResult,
  ToolRegistryService,
} from "../languageTypes";

/** Parsed components of a ToolShed tool ID. */
export interface ToolCoordinates {
  toolshedUrl: string;
  trsToolId: string;
  toolVersion: string | null;
}

const FETCH_TIMEOUT_MS = 30_000;
const POPULATE_CONCURRENCY = 5;

@injectable()
export class ToolRegistryServiceImpl implements ToolRegistryService {
  private memoryCache = new Map<string, CachedToolInfo>();
  private indexData: { entries: Record<string, CachedToolEntry> } | null = null;
  private cacheDir: string;
  private toolShedUrl: string;

  constructor() {
    this.cacheDir = path.join(os.homedir(), ".galaxy", "tool_info_cache");
    this.toolShedUrl = "https://toolshed.g2.bx.psu.edu";
  }

  configure(settings: { cacheDir: string; toolShedUrl: string }): void {
    const expanded = settings.cacheDir.replace(/^~/, os.homedir());
    this.cacheDir = expanded;
    this.toolShedUrl = settings.toolShedUrl;
    // Reset caches so they re-read from the new directory
    this.indexData = null;
    this.memoryCache.clear();
  }

  get cacheSize(): number {
    return Object.keys(this.loadIndex().entries).length;
  }

  async getToolInfo(toolId: string, toolVersion?: string): Promise<CachedToolInfo | null> {
    const coords = this.resolveCoordinates(toolId, toolVersion);
    if (!coords) return null;

    const key = this.computeCacheKey(coords.toolshedUrl, coords.trsToolId, coords.toolVersion!);

    // 1. Memory cache
    const cached = this.memoryCache.get(key);
    if (cached) return cached;

    // 2. Filesystem cache
    const fromFs = await this.readFromFilesystem(key);
    if (fromFs) {
      const info: CachedToolInfo = {
        toolId,
        toolVersion: coords.toolVersion!,
        parsedTool: fromFs,
        source: "cache",
      };
      this.memoryCache.set(key, info);
      return info;
    }

    // 3. Fetch from ToolShed
    try {
      const fetched = await this.fetchFromToolShed(coords.trsToolId, coords.toolVersion!, coords.toolshedUrl);
      const entry: CachedToolEntry = {
        cacheKey: key,
        toolId,
        toolVersion: coords.toolVersion!,
        source: "fetched",
        cachedAt: new Date().toISOString(),
      };
      await this.writeToCache(key, fetched, entry);
      const info: CachedToolInfo = { toolId, toolVersion: coords.toolVersion!, parsedTool: fetched, source: "fetched" };
      this.memoryCache.set(key, info);
      return info;
    } catch {
      return null;
    }
  }

  hasCached(toolId: string, toolVersion?: string): boolean {
    const coords = this.resolveCoordinates(toolId, toolVersion);
    if (!coords || !coords.toolVersion) return false;
    const key = this.computeCacheKey(coords.toolshedUrl, coords.trsToolId, coords.toolVersion);
    if (this.memoryCache.has(key)) return true;
    return key in this.loadIndex().entries;
  }

  listCached(): CachedToolEntry[] {
    return Object.values(this.loadIndex().entries);
  }

  async populateCache(tools: Array<{ toolId: string; toolVersion?: string }>): Promise<PopulateCacheResult> {
    const result: PopulateCacheResult = { fetched: 0, alreadyCached: 0, failed: [] };

    // Process in batches of POPULATE_CONCURRENCY
    for (let i = 0; i < tools.length; i += POPULATE_CONCURRENCY) {
      const batch = tools.slice(i, i + POPULATE_CONCURRENCY);
      await Promise.all(
        batch.map(async ({ toolId, toolVersion }) => {
          if (this.hasCached(toolId, toolVersion)) {
            result.alreadyCached++;
            return;
          }
          const info = await this.getToolInfo(toolId, toolVersion);
          if (info) {
            result.fetched++;
          } else {
            result.failed.push({ toolId, error: "Not found or fetch failed" });
          }
        })
      );
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Exposed for testing
  // ---------------------------------------------------------------------------

  parseToolshedToolId(toolId: string): ToolCoordinates | null {
    if (!toolId.includes("/repos/")) return null;
    const [toolshedBase, rest] = toolId.split("/repos/", 2);
    const segments = rest.split("/");
    if (segments.length < 3) return null;
    const trsToolId = `${segments[0]}~${segments[1]}~${segments[2]}`;
    const toolVersion = segments.length > 3 ? segments[3] : null;
    const toolshedUrl = toolshedBase.startsWith("http") ? toolshedBase : `https://${toolshedBase}`;
    return { toolshedUrl, trsToolId, toolVersion };
  }

  computeCacheKey(toolshedUrl: string, trsToolId: string, toolVersion: string): string {
    const raw = `${toolshedUrl}/${trsToolId}/${toolVersion}`;
    return createHash("sha256").update(raw).digest("hex");
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private resolveCoordinates(
    toolId: string,
    toolVersion?: string
  ): { toolshedUrl: string; trsToolId: string; toolVersion: string } | null {
    const coords = this.parseToolshedToolId(toolId);
    if (!coords) return null;
    const version = toolVersion ?? coords.toolVersion;
    if (!version) return null;
    return { toolshedUrl: coords.toolshedUrl, trsToolId: coords.trsToolId, toolVersion: version };
  }

  private async readFromFilesystem(cacheKey: string): Promise<ParsedToolJson | null> {
    try {
      const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as ParsedToolJson;
    } catch {
      return null;
    }
  }

  private async fetchFromToolShed(trsToolId: string, version: string, toolshedUrl: string): Promise<ParsedToolJson> {
    const url = `${toolshedUrl}/api/tools/${encodeURIComponent(trsToolId)}/versions/${encodeURIComponent(version)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
      }
      return (await response.json()) as ParsedToolJson;
    } finally {
      clearTimeout(timer);
    }
  }

  private async writeToCache(cacheKey: string, tool: ParsedToolJson, meta: CachedToolEntry): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(path.join(this.cacheDir, `${cacheKey}.json`), JSON.stringify(tool), "utf8");

    // Read-modify-write index.json
    const indexPath = path.join(this.cacheDir, "index.json");
    let index = this.loadIndex();
    index = { entries: { ...index.entries, [cacheKey]: meta } };
    await fs.writeFile(indexPath, JSON.stringify(index), "utf8");
    this.indexData = index;
  }

  private loadIndex(): { entries: Record<string, CachedToolEntry> } {
    if (this.indexData) return this.indexData;
    try {
      const indexPath = path.join(this.cacheDir, "index.json");
      const raw = fsSync.readFileSync(indexPath, "utf8");
      this.indexData = JSON.parse(raw) as { entries: Record<string, CachedToolEntry> };
    } catch {
      this.indexData = { entries: {} };
    }
    return this.indexData;
  }
}
