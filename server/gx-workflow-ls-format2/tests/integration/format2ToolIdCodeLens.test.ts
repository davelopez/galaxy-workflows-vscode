import type { ParsedTool } from "@galaxy-tool-util/core";
import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import "reflect-metadata";
import { GxFormat2WorkflowLanguageServiceImpl } from "../../src/languageService";
import { getLanguageService } from "@gxwf/yaml-language-service/src";
import { createFormat2WorkflowDocument } from "../testHelpers";

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

function makeService(registry: ToolRegistryService): GxFormat2WorkflowLanguageServiceImpl {
  const yaml = getLanguageService();
  return new GxFormat2WorkflowLanguageServiceImpl(yaml as never, { getSymbols: () => [] }, registry);
}

const YAML_WORKFLOW = `class: GalaxyWorkflow
inputs: {}
outputs: {}
steps:
  step1:
    tool_id: ${TOOL_ID}
    tool_version: "${TOOL_VERSION}"
`;

describe("Format2 doCodeLens", () => {
  it("cached → Open in ToolShed", async () => {
    const svc = makeService(makeRegistry({ cached: true }));
    const doc = createFormat2WorkflowDocument(YAML_WORKFLOW);
    const lenses = await svc.doCodeLens(doc);
    expect(lenses).toHaveLength(1);
    expect(lenses[0].command!.command).toBe("galaxy-workflows.openToolInToolShed");
  });

  it("uncached → Populate Tool Cache", async () => {
    const svc = makeService(makeRegistry({ cached: false }));
    const doc = createFormat2WorkflowDocument(YAML_WORKFLOW);
    const lenses = await svc.doCodeLens(doc);
    expect(lenses[0].command!.command).toBe("galaxy-workflows.populateToolCache");
  });

  it("failed → per-tool retry", async () => {
    const svc = makeService(makeRegistry({ cached: false, failed: true }));
    const doc = createFormat2WorkflowDocument(YAML_WORKFLOW);
    const lenses = await svc.doCodeLens(doc);
    expect(lenses[0].command!.command).toBe("galaxy-workflows.populateToolCacheForTool");
  });
});
