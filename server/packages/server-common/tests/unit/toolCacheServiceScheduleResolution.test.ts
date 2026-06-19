import { describe, it, expect, vi } from "vitest";
import { getLanguageService } from "vscode-json-languageservice";

import type {
  DocumentContext,
  GalaxyWorkflowLanguageServer,
  PopulateToolCacheResult,
  ToolRegistryService,
} from "../../src/languageTypes";
import { TextDocument } from "../../src/languageTypes";
import { WorkflowDocument } from "../../src/models/workflowDocument";
import { ToolCacheService } from "../../src/services/toolCacheService";

const FASTP = "toolshed.g2.bx.psu.edu/repos/iuc/fastp/fastp/1.1.0+galaxy0";
const MULTIQC = "toolshed.g2.bx.psu.edu/repos/iuc/multiqc/multiqc/1.33+galaxy0";

class TestWorkflowDocument extends WorkflowDocument {
  public getWorkflowInputs(): never {
    throw new Error("not used");
  }
  public getWorkflowOutputs(): never {
    throw new Error("not used");
  }
}

function createDoc(): DocumentContext {
  const json = JSON.stringify({
    a_galaxy_workflow: "true",
    steps: {
      "0": { id: 0, type: "data_input", tool_id: null },
      "1": { id: 1, type: "tool", tool_id: FASTP, tool_version: "1.1.0+galaxy0" },
      "2": { id: 2, type: "tool", tool_id: MULTIQC, tool_version: "1.33+galaxy0" },
    },
  });
  const textDoc = TextDocument.create("foo://bar/iwc.ga", "json", 0, json);
  const ls = getLanguageService({});
  const jsonDoc = ls.parseJSONDocument(textDoc);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new TestWorkflowDocument(textDoc, jsonDoc as any);
}

function makeRegistry(populateSpy: ReturnType<typeof vi.fn>): ToolRegistryService {
  return {
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
    clearResolutionFailed() {
      /* noop */
    },
    async validateNativeStep() {
      return [];
    },
  } as unknown as ToolRegistryService;
}

function makeServer(autoResolutionEnabled: boolean, registry: ToolRegistryService): GalaxyWorkflowLanguageServer {
  return {
    connection: {
      onRequest: () => {
        /* noop */
      },
      sendNotification: () => {
        /* noop */
      },
    },
    toolRegistryService: registry,
    documentsCache: { get: () => undefined, all: () => [] },
    autoResolutionEnabled,
    revalidateDocument: () => {
      /* noop */
    },
  } as unknown as GalaxyWorkflowLanguageServer;
}

describe("ToolCacheService.scheduleResolution", () => {
  it("auto-resolves uncached tools after the debounce when enabled", async () => {
    const populateSpy = vi.fn(
      async (): Promise<PopulateToolCacheResult> => ({ fetched: 2, alreadyCached: 0, failed: [] })
    );
    const service = new ToolCacheService(makeServer(true, makeRegistry(populateSpy)));

    await service.scheduleResolution(createDoc());
    await new Promise((r) => setTimeout(r, 400));

    expect(populateSpy).toHaveBeenCalledTimes(1);
    const tools = populateSpy.mock.calls[0][0] as Array<{ toolId: string }>;
    expect(tools.map((t) => t.toolId).sort()).toEqual([FASTP, MULTIQC].sort());
  });

  it("does not auto-resolve when disabled", async () => {
    const populateSpy = vi.fn(
      async (): Promise<PopulateToolCacheResult> => ({ fetched: 0, alreadyCached: 0, failed: [] })
    );
    const service = new ToolCacheService(makeServer(false, makeRegistry(populateSpy)));

    await service.scheduleResolution(createDoc());
    await new Promise((r) => setTimeout(r, 400));

    expect(populateSpy).not.toHaveBeenCalled();
  });
});
