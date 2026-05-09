import type { ParsedTool } from "@galaxy-tool-util/schema";
import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import "reflect-metadata";
import { NativeWorkflowLanguageServiceImpl } from "../../src/languageService";
import { createNativeWorkflowDocument } from "../testHelpers";

const TOOL_ID = "toolshed.g2.bx.psu.edu/repos/devteam/bowtie2/bowtie2/2.4.4";
const TOOL_VERSION = "2.4.4";

function makeParsedTool(): ParsedTool {
  return {
    id: TOOL_ID,
    version: TOOL_VERSION,
    name: "Bowtie2",
    description: null,
    inputs: [],
    outputs: [],
    citations: [],
    license: null,
    profile: null,
    edam_operations: [],
    edam_topics: [],
    xrefs: [],
    help: null,
  };
}

function makeRegistry(opts: { cached?: boolean; failed?: boolean } = {}): ToolRegistryService {
  const { cached = true, failed = false } = opts;
  return {
    async hasCached(id) {
      return cached && id === TOOL_ID;
    },
    async listCached() {
      return [];
    },
    async populateCache() {
      return { fetched: 0, alreadyCached: 0, failed: [] };
    },
    configure() {
      /* noop */
    },
    async getCacheSize() {
      return cached ? 1 : 0;
    },
    async getToolParameters() {
      return null;
    },
    async getToolInfo(id) {
      return cached && id === TOOL_ID ? makeParsedTool() : null;
    },
    getToolShedBaseUrl() {
      return "https://toolshed.g2.bx.psu.edu";
    },
    hasResolutionFailed(id) {
      return failed && id === TOOL_ID;
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
  };
}

function makeService(registry: ToolRegistryService): NativeWorkflowLanguageServiceImpl {
  return new NativeWorkflowLanguageServiceImpl({ getSymbols: () => [] }, registry);
}

const WORKFLOW_JSON = JSON.stringify(
  {
    a_galaxy_workflow: "true",
    steps: {
      "0": { id: 0, type: "tool", tool_id: TOOL_ID, tool_version: TOOL_VERSION },
    },
  },
  null,
  2
);

describe("Native doCodeLens", () => {
  it("cached → Open in ToolShed", async () => {
    const svc = makeService(makeRegistry({ cached: true }));
    const doc = createNativeWorkflowDocument(WORKFLOW_JSON);
    const lenses = await svc.doCodeLens(doc);
    expect(lenses).toHaveLength(1);
    expect(lenses[0].command!.command).toBe("galaxy-workflows.openToolInToolShed");
    expect(lenses[0].command!.title).toContain("Bowtie2");
  });

  it("uncached → Populate Tool Cache", async () => {
    const svc = makeService(makeRegistry({ cached: false }));
    const doc = createNativeWorkflowDocument(WORKFLOW_JSON);
    const lenses = await svc.doCodeLens(doc);
    expect(lenses).toHaveLength(1);
    expect(lenses[0].command!.command).toBe("galaxy-workflows.populateToolCache");
  });

  it("failed → per-tool retry", async () => {
    const svc = makeService(makeRegistry({ cached: false, failed: true }));
    const doc = createNativeWorkflowDocument(WORKFLOW_JSON);
    const lenses = await svc.doCodeLens(doc);
    expect(lenses).toHaveLength(1);
    expect(lenses[0].command!.command).toBe("galaxy-workflows.populateToolCacheForTool");
    expect(lenses[0].command!.arguments?.[0]).toEqual({ toolId: TOOL_ID, toolVersion: TOOL_VERSION });
  });
});
