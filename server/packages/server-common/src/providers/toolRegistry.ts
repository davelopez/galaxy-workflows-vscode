import { injectable } from "inversify";
import { ToolInfoService } from "@galaxy-tool-util/core";
import { ToolStateValidator } from "@galaxy-tool-util/schema";
import type { CacheStorage, ToolStateDiagnostic, ToolRegistryService } from "../languageTypes";
import type { PopulateToolCacheResult } from "../../../../../shared/src/requestsDefinitions";

const POPULATE_CONCURRENCY = 5;

@injectable()
export class ToolRegistryServiceImpl implements ToolRegistryService {
  private toolInfo: ToolInfoService;
  private _validator: ToolStateValidator;
  private _resolutionFailed = new Set<string>();

  constructor() {
    this.toolInfo = new ToolInfoService({ storage: new NullStorage() });
    this._validator = new ToolStateValidator(this.toolInfo);
  }

  private resolutionKey(toolId: string, toolVersion?: string): string {
    return `${toolId}@${toolVersion ?? ""}`;
  }

  hasResolutionFailed(toolId: string, toolVersion?: string): boolean {
    return this._resolutionFailed.has(this.resolutionKey(toolId, toolVersion));
  }

  markResolutionFailed(toolId: string, toolVersion?: string): void {
    this._resolutionFailed.add(this.resolutionKey(toolId, toolVersion));
  }

  configure(settings: { toolShedUrl: string; storage: CacheStorage }): void {
    this.toolInfo = new ToolInfoService({
      defaultToolshedUrl: settings.toolShedUrl,
      storage: settings.storage,
    });
    this._validator = new ToolStateValidator(this.toolInfo);
  }

  async hasCached(toolId: string, toolVersion?: string): Promise<boolean> {
    return this.toolInfo.cache.hasCached(toolId, toolVersion ?? null);
  }

  async listCached() {
    return this.toolInfo.cache.listCached();
  }

  async getCacheSize(): Promise<number> {
    return (await this.toolInfo.cache.listCached()).length;
  }

  async getToolParameters(toolId: string, toolVersion?: string): Promise<unknown[] | null> {
    if (!(await this.hasCached(toolId, toolVersion))) {
      return null;
    }
    const tool = await this.toolInfo.getToolInfo(toolId, toolVersion ?? null);
    return tool?.inputs ?? null;
  }

  async validateNativeStep(
    toolId: string,
    toolVersion: string | undefined,
    toolState: Record<string, unknown>,
    inputConnections?: Record<string, unknown>
  ): Promise<ToolStateDiagnostic[]> {
    return this._validator.validateNativeStep(toolId, toolVersion ?? null, toolState, inputConnections);
  }

  async populateCache(tools: Array<{ toolId: string; toolVersion?: string }>): Promise<PopulateToolCacheResult> {
    const result: PopulateToolCacheResult = { fetched: 0, alreadyCached: 0, failed: [] };

    for (let i = 0; i < tools.length; i += POPULATE_CONCURRENCY) {
      const batch = tools.slice(i, i + POPULATE_CONCURRENCY);
      await Promise.all(
        batch.map(async ({ toolId, toolVersion }) => {
          if (await this.hasCached(toolId, toolVersion)) {
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

// Placeholder storage used before configure() supplies the real backing store.
class NullStorage implements CacheStorage {
  async load(): Promise<null> { return null; }
  async save(): Promise<void> {}
  async delete(): Promise<void> {}
  async list(): Promise<string[]> { return []; }
}
