import type { ParsedTool } from "@galaxy-tool-util/schema";
import type { DocumentContext, ToolRegistryService } from "../../src/languageTypes";
import { TextDocument } from "../../src/languageTypes";
import { WorkflowDocument } from "../../src/models/workflowDocument";
import { buildToolIdCodeLenses } from "../../src/providers/toolIdCodeLens";
import { getLanguageService } from "vscode-json-languageservice";

const TOOLSHED_ID = "toolshed.g2.bx.psu.edu/repos/devteam/bowtie2/bowtie2/2.4.4";
const BUILTIN_ID = "Cut1";

interface RegistryOpts {
  cached?: Record<string, boolean>;
  failed?: Record<string, boolean>;
  info?: Record<string, ParsedTool>;
}

function makeRegistry(opts: RegistryOpts = {}): ToolRegistryService {
  const cached = opts.cached ?? {};
  const failed = opts.failed ?? {};
  const info = opts.info ?? {};
  return {
    async hasCached(id) {
      return Boolean(cached[id]);
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
      return 0;
    },
    async getToolParameters() {
      return null;
    },
    async getToolInfo(id) {
      return info[id] ?? null;
    },
    getToolShedBaseUrl() {
      return "https://toolshed.g2.bx.psu.edu";
    },
    hasResolutionFailed(id) {
      return Boolean(failed[id]);
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

function makeParsedTool(id: string, name: string, version: string | null): ParsedTool {
  return {
    id,
    version,
    name,
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

class TestWorkflowDocument extends WorkflowDocument {
  public getWorkflowInputs(): never {
    throw new Error("not used");
  }
  public getWorkflowOutputs(): never {
    throw new Error("not used");
  }
}

function createDoc(json: string): DocumentContext {
  const textDoc = TextDocument.create("foo://bar/file.ga", "json", 0, json);
  const ls = getLanguageService({});
  const jsonDoc = ls.parseJSONDocument(textDoc);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new TestWorkflowDocument(textDoc, jsonDoc as any);
}

const FIXTURE = JSON.stringify(
  {
    a_galaxy_workflow: "true",
    steps: {
      "0": { id: 0, type: "tool", tool_id: TOOLSHED_ID, tool_version: "2.4.4" },
      "1": { id: 1, type: "tool", tool_id: BUILTIN_ID, tool_version: "1.0" },
      "2": { id: 2, type: "tool", tool_id: "other/failing/tool", tool_version: "0.1" },
    },
  },
  null,
  2
);

describe("buildToolIdCodeLenses", () => {
  it("emits 'Open in ToolShed' lens for cached toolshed tool", async () => {
    const doc = createDoc(FIXTURE);
    const registry = makeRegistry({
      cached: { [TOOLSHED_ID]: true },
      info: { [TOOLSHED_ID]: makeParsedTool(TOOLSHED_ID, "Bowtie2", "2.4.4") },
    });
    const lenses = await buildToolIdCodeLenses(doc, registry);
    const lens = lenses.find((l) => l.command?.title.includes("Bowtie2"));
    expect(lens).toBeDefined();
    expect(lens!.command!.title).toContain("$(check)");
    expect(lens!.command!.title).toContain("Open in ToolShed");
    expect(lens!.command!.command).toBe("galaxy-workflows.openToolInToolShed");
    expect(lens!.command!.arguments?.[0]).toMatchObject({ toolId: TOOLSHED_ID, toolVersion: "2.4.4" });
  });

  it("emits command-less lens for cached built-in (short) tool id", async () => {
    const doc = createDoc(FIXTURE);
    const registry = makeRegistry({
      cached: { [BUILTIN_ID]: true },
      info: { [BUILTIN_ID]: makeParsedTool(BUILTIN_ID, "Cut", "1.0") },
    });
    const lenses = await buildToolIdCodeLenses(doc, registry);
    const lens = lenses.find((l) => l.command?.title.includes("Cut"));
    expect(lens).toBeDefined();
    expect(lens!.command!.title).toContain("$(check)");
    expect(lens!.command!.title).toContain("Cut");
    expect(lens!.command!.command).toBe("");
  });

  it("emits 'Populate Tool Cache' lens for uncached tool", async () => {
    const doc = createDoc(FIXTURE);
    const lenses = await buildToolIdCodeLenses(doc, makeRegistry());
    expect(lenses).toHaveLength(3);
    for (const lens of lenses) {
      expect(lens.command!.title).toContain("$(info)");
      expect(lens.command!.title).toContain("Run Populate Tool Cache");
      expect(lens.command!.command).toBe("galaxy-workflows.populateToolCache");
      expect(lens.command!.arguments).toBeUndefined();
    }
  });

  it("emits retry lens for resolution-failed tool with per-tool retry args", async () => {
    const doc = createDoc(FIXTURE);
    const registry = makeRegistry({ failed: { "other/failing/tool": true } });
    const lenses = await buildToolIdCodeLenses(doc, registry);
    const retry = lenses.find((l) => l.command?.title.includes("other/failing/tool"));
    expect(retry).toBeDefined();
    expect(retry!.command!.title).toContain("$(error)");
    expect(retry!.command!.title).toContain("retry");
    expect(retry!.command!.command).toBe("galaxy-workflows.populateToolCacheForTool");
    expect(retry!.command!.arguments?.[0]).toEqual({ toolId: "other/failing/tool", toolVersion: "0.1" });
  });

  it("range matches the tool_id value span", async () => {
    const doc = createDoc(FIXTURE);
    const lenses = await buildToolIdCodeLenses(doc, makeRegistry());
    const targetLens = lenses[0];
    const text = doc.textDocument.getText();
    const idx = text.indexOf(TOOLSHED_ID);
    const startOffset = doc.textDocument.offsetAt(targetLens.range.start);
    const endOffset = doc.textDocument.offsetAt(targetLens.range.end);
    // String nodes in JSON AST include quotes, so start should sit at the opening quote.
    expect(startOffset).toBe(idx - 1);
    expect(endOffset).toBe(idx + TOOLSHED_ID.length + 1);
  });

  it("returns empty when no step has a tool_id", async () => {
    const json = JSON.stringify({ a_galaxy_workflow: "true", steps: { "0": { id: 0, type: "data_input" } } }, null, 2);
    const doc = createDoc(json);
    const lenses = await buildToolIdCodeLenses(doc, makeRegistry());
    expect(lenses).toEqual([]);
  });
});
