import type { ParsedTool } from "@galaxy-tool-util/core";
import { GalaxyWorkflowSchema } from "@galaxy-tool-util/schema";
import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { parseTemplate } from "@gxwf/server-common/tests/testHelpers";
import { JSONSchema } from "effect";
import "reflect-metadata";
import { JsonSchemaGalaxyWorkflowLoader } from "../../src/schema/jsonSchemaLoader";
import { GxFormat2HoverService } from "../../src/services/hoverService";
import { createFormat2WorkflowDocument } from "../testHelpers";

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

function makeRegistry(cached = true, failed = false): ToolRegistryService {
  return {
    async hasCached(id) { return cached && id === TOOL_ID; },
    async listCached() { return []; },
    async populateCache() { return { fetched: 0, alreadyCached: 0, failed: [] }; },
    configure() { /* noop */ },
    async getCacheSize() { return cached ? 1 : 0; },
    async getToolParameters() { return null; },
    async getToolInfo(id) { return cached && id === TOOL_ID ? makeParsedTool() : null; },
    getToolShedBaseUrl() { return "https://toolshed.g2.bx.psu.edu"; },
    hasResolutionFailed() { return failed; },
    markResolutionFailed() { /* noop */ },
    clearResolutionFailed() { /* noop */ },
    async validateNativeStep() { return []; },
  };
}

const galaxyWorkflowJsonSchema = JSONSchema.make(GalaxyWorkflowSchema) as Record<string, unknown>;
const SCHEMA_RESOLVER = new JsonSchemaGalaxyWorkflowLoader(galaxyWorkflowJsonSchema).nodeResolver;

function makeYaml(): string {
  return `class: GalaxyWorkflow
inputs: {}
outputs: {}
steps:
  step1:
    tool_id: ${TOOL_ID}
    tool_version: "${TOOL_VERSION}"
`;
}

async function hoverOnToolId(svc: GxFormat2HoverService, yaml: string) {
  // Place cursor inside the tool_id value
  const template = yaml.replace(TOOL_ID, TOOL_ID.slice(0, 3) + "$" + TOOL_ID.slice(3));
  const { contents, position } = parseTemplate(template);
  const doc = createFormat2WorkflowDocument(contents);
  return svc.doHover(doc, position);
}

describe("Format2 tool_id hover", () => {
  it("cached tool → returns tool-info markdown", async () => {
    const svc = new GxFormat2HoverService(SCHEMA_RESOLVER, makeRegistry());
    const hover = await hoverOnToolId(svc, makeYaml());
    expect(hover).not.toBeNull();
    const text = (hover!.contents as { value: string }).value;
    expect(text).toContain("Bowtie2");
    expect(text).toContain("Map reads to a reference genome.");
  });

  it("uncached tool → returns Populate Tool Cache hint", async () => {
    const svc = new GxFormat2HoverService(SCHEMA_RESOLVER, makeRegistry(false));
    const hover = await hoverOnToolId(svc, makeYaml());
    expect(hover).not.toBeNull();
    const text = (hover!.contents as { value: string }).value;
    expect(text).toContain("Populate Tool Cache");
  });

  it("regression: schema fallback is NOT used when hovering on tool_id", async () => {
    const svc = new GxFormat2HoverService(SCHEMA_RESOLVER, makeRegistry());
    const hover = await hoverOnToolId(svc, makeYaml());
    expect(hover).not.toBeNull();
    const text = (hover!.contents as { value: string }).value;
    // Schema doc for tool_id property would mention the schema's field description,
    // but our tool-info hover replaces it. Confirm the tool name shows instead.
    expect(text).toContain("Bowtie2");
    expect(text).not.toMatch(/Schema node not found/);
  });

  it("failed resolution → returns Could not resolve message", async () => {
    const svc = new GxFormat2HoverService(SCHEMA_RESOLVER, makeRegistry(false, true));
    const hover = await hoverOnToolId(svc, makeYaml());
    expect(hover).not.toBeNull();
    const text = (hover!.contents as { value: string }).value;
    expect(text).toContain("Could not resolve");
  });
});
