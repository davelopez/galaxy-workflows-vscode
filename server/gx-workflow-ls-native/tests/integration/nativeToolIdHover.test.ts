import type { ParsedTool } from "@galaxy-tool-util/schema";
import { Hover, ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { parseTemplate } from "@gxwf/server-common/tests/testHelpers";
import "reflect-metadata";
import { NativeHoverService } from "../../src/services/nativeHoverService";
import { createNativeWorkflowDocument } from "../testHelpers";

const TOOL_ID = "toolshed.g2.bx.psu.edu/repos/devteam/bowtie2/bowtie2/2.4.4";
const TOOL_VERSION = "2.4.4";

function makeParsedTool(): ParsedTool {
  return {
    id: TOOL_ID,
    version: TOOL_VERSION,
    name: "Bowtie2",
    description: "Map reads to a reference genome.",
    inputs: [],
    outputs: [],
    citations: [],
    license: "MIT",
    profile: null,
    edam_operations: [],
    edam_topics: [],
    xrefs: [],
    help: null,
  };
}

interface RegistryOpts {
  cached?: boolean;
  failed?: boolean;
}

function makeRegistry(opts: RegistryOpts = {}): ToolRegistryService {
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
    hasResolutionFailed() {
      return failed;
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

function makeWorkflow(toolId = TOOL_ID): string {
  return JSON.stringify(
    {
      a_galaxy_workflow: "true",
      steps: {
        "0": {
          id: 0,
          type: "tool",
          tool_id: toolId,
          tool_version: TOOL_VERSION,
          tool_state: {},
          input_connections: {},
          outputs: [],
        },
      },
    },
    null,
    2
  );
}

async function hoverAt(service: NativeHoverService, contents: string, cursorTarget: string): Promise<Hover | null> {
  // Insert $ marker inside the target string value to simulate cursor.
  const template = contents.replace(cursorTarget, cursorTarget.slice(0, 2) + "$" + cursorTarget.slice(2));
  const { contents: finalContents, position } = parseTemplate(template);
  const doc = createNativeWorkflowDocument(finalContents);
  return service.doHover(doc, position);
}

describe("Native tool_id hover", () => {
  it("cached tool → returns markdown with name + description + license", async () => {
    const svc = new NativeHoverService(makeRegistry());
    const hover = await hoverAt(svc, makeWorkflow(), `"${TOOL_ID}"`);
    expect(hover).not.toBeNull();
    const text = (hover!.contents as { value: string }).value;
    expect(text).toContain("Bowtie2");
    expect(text).toContain("Map reads to a reference genome.");
    expect(text).toContain("License: MIT");
    expect(text).toContain("https://toolshed.g2.bx.psu.edu/view/devteam/bowtie2");
  });

  it("uncached tool → returns Populate Tool Cache hint", async () => {
    const svc = new NativeHoverService(makeRegistry({ cached: false }));
    const hover = await hoverAt(svc, makeWorkflow(), `"${TOOL_ID}"`);
    expect(hover).not.toBeNull();
    const text = (hover!.contents as { value: string }).value;
    expect(text).toContain("Populate Tool Cache");
  });

  it("failed resolution → returns Could not resolve message", async () => {
    const svc = new NativeHoverService(makeRegistry({ cached: false, failed: true }));
    const hover = await hoverAt(svc, makeWorkflow(), `"${TOOL_ID}"`);
    expect(hover).not.toBeNull();
    const text = (hover!.contents as { value: string }).value;
    expect(text).toContain("Could not resolve");
  });

  it("short (built-in) tool id → no /view/ link", async () => {
    const svc = new NativeHoverService({
      ...makeRegistry(),
      async hasCached(id) {
        return id === "Cut1";
      },
      async getToolInfo(id) {
        if (id !== "Cut1") return null;
        return { ...makeParsedTool(), id: "Cut1", name: "Cut", version: "1.0" };
      },
    });
    const hover = await hoverAt(svc, makeWorkflow("Cut1"), `"Cut1"`);
    expect(hover).not.toBeNull();
    const text = (hover!.contents as { value: string }).value;
    expect(text).not.toContain("/view/");
  });
});
