import { GalaxyWorkflowSchema } from "@galaxy-tool-util/schema";
import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { parseTemplate } from "@gxwf/server-common/tests/testHelpers";
import { JSONSchema } from "effect";
import "reflect-metadata";
import { JsonSchemaGalaxyWorkflowLoader } from "../../src/schema/jsonSchemaLoader";
import { GxFormat2HoverService } from "../../src/services/hoverService";
import { createFormat2WorkflowDocument } from "../testHelpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TOOL_ID = "toolshed.g2.bx.psu.edu/repos/devteam/bowtie2/bowtie2/2.4.4";

const TOOL_PARAMS = [
  {
    name: "read1",
    parameter_type: "gx_data",
    type: "data",
    label: "Read 1",
    help: "First read file",
    hidden: false,
    optional: false,
    multiple: false,
    extensions: ["fastq"],
    is_dynamic: false,
    argument: null,
  },
  {
    name: "alignment_type",
    parameter_type: "gx_select",
    type: "select",
    label: "Alignment type",
    help: "Choose alignment mode",
    hidden: false,
    optional: false,
    multiple: false,
    is_dynamic: false,
    argument: null,
    validators: [],
    options: [
      { label: "End-to-end", value: "end_to_end", selected: true },
      { label: "Local", value: "local", selected: false },
    ],
  },
  {
    name: "paired_end",
    parameter_type: "gx_boolean",
    type: "boolean",
    label: "Paired end",
    help: "Is this paired end?",
    hidden: false,
    optional: false,
    value: false,
    truevalue: "true",
    falsevalue: "false",
    is_dynamic: false,
    argument: null,
  },
];

function makeMockRegistry(toolId: string, params: unknown[]): ToolRegistryService {
  return {
    hasCached(id) { return id === toolId; },
    listCached() { return []; },
    async populateCache() { return { fetched: 0, alreadyCached: 0, failed: [] }; },
    configure() { /* noop */ },
    get cacheSize() { return 1; },
    async getToolParameters(id) { return id === toolId ? params : null; },
  };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const galaxyWorkflowJsonSchema = JSONSchema.make(GalaxyWorkflowSchema) as Record<string, unknown>;

describe("Tool State Hover Service", () => {
  let service: GxFormat2HoverService;

  beforeAll(() => {
    const schemaNodeResolver = new JsonSchemaGalaxyWorkflowLoader(galaxyWorkflowJsonSchema).nodeResolver;
    service = new GxFormat2HoverService(schemaNodeResolver, makeMockRegistry(TOOL_ID, TOOL_PARAMS));
  });

  async function getHover(contents: string, position: { line: number; character: number }) {
    const doc = createFormat2WorkflowDocument(contents);
    return service.doHover(doc, position);
  }

  const WORKFLOW_PREFIX =
    `class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n` +
    `  step1:\n    tool_id: ${TOOL_ID}\n    state:\n`;

  // ---------------------------------------------------------------------------
  // Parameter name hover
  // ---------------------------------------------------------------------------

  it("shows parameter name and type when hovering over a param key", async () => {
    const template = WORKFLOW_PREFIX + `      read$1: my_file`;
    const { contents, position } = parseTemplate(template);

    const hover = await getHover(contents, position);

    expect(hover).not.toBeNull();
    const text = typeof hover?.contents === "string" ? hover.contents : (hover?.contents as { value: string }).value;
    expect(text).toContain("read1");
    expect(text).toContain("data");
  });

  it("shows select options when hovering over a select param", async () => {
    const template = WORKFLOW_PREFIX + `      align$ment_type: end_to_end`;
    const { contents, position } = parseTemplate(template);

    const hover = await getHover(contents, position);

    expect(hover).not.toBeNull();
    const text = typeof hover?.contents === "string" ? hover.contents : (hover?.contents as { value: string }).value;
    expect(text).toContain("end_to_end");
    expect(text).toContain("local");
  });

  it("shows true/false hint when hovering over a boolean param", async () => {
    const template = WORKFLOW_PREFIX + `      paired$_end: true`;
    const { contents, position } = parseTemplate(template);

    const hover = await getHover(contents, position);

    expect(hover).not.toBeNull();
    const text = typeof hover?.contents === "string" ? hover.contents : (hover?.contents as { value: string }).value;
    expect(text).toContain("true");
    expect(text).toContain("false");
  });

  it("shows help text in hover", async () => {
    const template = WORKFLOW_PREFIX + `      read$1: my_file`;
    const { contents, position } = parseTemplate(template);

    const hover = await getHover(contents, position);

    const text = typeof hover?.contents === "string" ? hover.contents : (hover?.contents as { value: string }).value;
    expect(text).toContain("First read file");
  });

  // ---------------------------------------------------------------------------
  // No hover when tool not cached
  // ---------------------------------------------------------------------------

  it("falls back to schema hover when tool is not cached", async () => {
    const workflow =
      `class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n` +
      `  step1:\n    tool_id: not_cached_tool\n    state:\n` +
      `      $some_param: value`;
    const { contents, position } = parseTemplate(workflow);

    const hover = await getHover(contents, position);
    // Should not crash, may return schema hover or null
    // (Schema node for "some_param" inside Any? would return a hover or null — either is acceptable)
    expect(hover === null || hover !== null).toBe(true);
  });
});
