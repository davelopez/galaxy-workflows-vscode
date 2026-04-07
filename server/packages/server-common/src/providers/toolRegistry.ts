import * as os from "node:os";
import { injectable } from "inversify";
import { ToolInfoService } from "@galaxy-tool-util/core";
import type { ToolRegistryService } from "../languageTypes";
import type { PopulateToolCacheResult } from "../../../../../shared/src/requestsDefinitions";

const POPULATE_CONCURRENCY = 5;

@injectable()
export class ToolRegistryServiceImpl implements ToolRegistryService {
  private toolInfo: ToolInfoService;

  constructor() {
    this.toolInfo = new ToolInfoService();
  }

  configure(settings: { cacheDir: string; toolShedUrl: string }): void {
    const cacheDir = settings.cacheDir.replace(/^~/, os.homedir());
    this.toolInfo = new ToolInfoService({
      cacheDir,
      defaultToolshedUrl: settings.toolShedUrl,
    });
  }

  hasCached(toolId: string, toolVersion?: string): boolean {
    return this.toolInfo.cache.hasCached(toolId, toolVersion ?? null);
  }

  listCached() {
    return this.toolInfo.cache.listCached();
  }

  get cacheSize(): number {
    return this.toolInfo.cache.listCached().length;
  }

  async getToolParameters(toolId: string, toolVersion?: string): Promise<unknown[] | null> {
    if (!this.hasCached(toolId, toolVersion)) {
      return null;
    }
    const tool = await this.toolInfo.getToolInfo(toolId, toolVersion ?? null);
    return tool?.inputs ?? null;
  }

  async populateCache(tools: Array<{ toolId: string; toolVersion?: string }>): Promise<PopulateToolCacheResult> {
    const result: PopulateToolCacheResult = { fetched: 0, alreadyCached: 0, failed: [] };

    for (let i = 0; i < tools.length; i += POPULATE_CONCURRENCY) {
      const batch = tools.slice(i, i + POPULATE_CONCURRENCY);
      await Promise.all(
        batch.map(async ({ toolId, toolVersion }) => {
          if (this.hasCached(toolId, toolVersion)) {
            result.alreadyCached++;
            return;
          }
          try {
            const info = await this.toolInfo.getToolInfo(toolId, toolVersion ?? null);
            if (info) {
              result.fetched++;
            } else {
              result.failed.push({ toolId, error: "not found" });
            }
          } catch {
            result.failed.push({ toolId, error: "not found" });
          }
        }),
      );
    }

    return result;
  }
}
