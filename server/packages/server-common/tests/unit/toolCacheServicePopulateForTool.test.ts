import type {
  GalaxyWorkflowLanguageServer,
  PopulateToolCacheResult,
  ToolRegistryService,
} from "../../src/languageTypes";
import { LSRequestIdentifiers } from "../../src/languageTypes";
import { ToolCacheService } from "../../src/services/toolCacheService";

/**
 * Capture the handler registered for POPULATE_TOOL_CACHE_FOR_TOOL so we can
 * exercise the service directly without spinning up an LSP connection.
 */
function setup(registry: Partial<ToolRegistryService> = {}): {
  handler: (params: { toolId: string; toolVersion?: string }) => Promise<PopulateToolCacheResult>;
  populateSpy: ReturnType<typeof vi.fn>;
  clearSpy: ReturnType<typeof vi.fn>;
} {
  const populateSpy = vi.fn(async () => ({ fetched: 1, alreadyCached: 0, failed: [] }));
  const clearSpy = vi.fn();
  const reg: ToolRegistryService = {
    async hasCached() {
      return false;
    },
    async listCached() {
      return [];
    },
    populateCache: populateSpy,
    configure() {
      /* noop */
    },
    async getCacheSize() {
      return 0;
    },
    async getToolParameters() {
      return null;
    },
    async getToolInfo() {
      return null;
    },
    getToolShedBaseUrl() {
      return undefined;
    },
    hasResolutionFailed() {
      return false;
    },
    markResolutionFailed() {
      /* noop */
    },
    clearResolutionFailed: clearSpy,
    async validateNativeStep() {
      return [];
    },
    ...registry,
  };

  const handlers = new Map<string, (params: unknown) => unknown>();
  const server = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: {
      onRequest: (name: string, cb: (params: unknown) => unknown) => {
        handlers.set(name, cb);
      },
      sendNotification: () => {
        /* noop */
      },
    } as any,
    toolRegistryService: reg,
    documentsCache: { get: () => undefined, all: () => [] } as any,
    autoResolutionEnabled: false,
    revalidateDocument: () => {
      /* noop */
    },
  } as unknown as GalaxyWorkflowLanguageServer;

  new ToolCacheService(server);
  const handler = handlers.get(LSRequestIdentifiers.POPULATE_TOOL_CACHE_FOR_TOOL);
  if (!handler) throw new Error("POPULATE_TOOL_CACHE_FOR_TOOL handler not registered");
  return {
    handler: handler as (params: { toolId: string; toolVersion?: string }) => Promise<PopulateToolCacheResult>,
    populateSpy,
    clearSpy,
  };
}

// vitest globals via tsconfig
import { describe, it, expect, vi } from "vitest";

describe("POPULATE_TOOL_CACHE_FOR_TOOL handler", () => {
  it("delegates to populateCache with a single-element batch", async () => {
    const { handler, populateSpy } = setup();
    await handler({ toolId: "x", toolVersion: "1.0" });
    expect(populateSpy).toHaveBeenCalledTimes(1);
    expect(populateSpy).toHaveBeenCalledWith([{ toolId: "x", toolVersion: "1.0" }]);
  });

  it("clears the resolution-failed flag on success", async () => {
    const { handler, clearSpy } = setup();
    await handler({ toolId: "x" });
    expect(clearSpy).toHaveBeenCalledWith("x", undefined);
  });

  it("does NOT clear the resolution-failed flag when the retry fails", async () => {
    const { handler, clearSpy } = setup({
      populateCache: async () => ({ fetched: 0, alreadyCached: 0, failed: [{ toolId: "x", error: "not found" }] }),
    });
    const result = await handler({ toolId: "x" });
    expect(result.failed).toHaveLength(1);
    expect(clearSpy).not.toHaveBeenCalled();
  });
});
