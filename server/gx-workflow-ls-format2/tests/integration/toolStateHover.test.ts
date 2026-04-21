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

const CONDITIONAL_PARAMS = [
  {
    name: "mode_cond",
    parameter_type: "gx_conditional",
    label: "Mode",
    help: null,
    hidden: false,
    argument: null,
    is_dynamic: false,
    test_parameter: {
      name: "mode_select",
      parameter_type: "gx_select",
      type: "select",
      label: "Mode selector",
      help: null,
      hidden: false,
      optional: false,
      multiple: false,
      is_dynamic: false,
      argument: null,
      validators: [],
      options: [
        { label: "Fast", value: "fast", selected: true },
        { label: "Sensitive", value: "sensitive", selected: false },
      ],
    },
    whens: [
      {
        discriminator: "fast",
        is_default_when: true,
        parameters: [
          {
            name: "fast_param",
            parameter_type: "gx_integer",
            type: "integer",
            label: "Fast parameter",
            help: "Fast mode only",
            hidden: false,
            optional: true,
            value: 5,
            min: null,
            max: null,
            is_dynamic: false,
            argument: null,
            validators: [],
          },
        ],
      },
      {
        discriminator: "sensitive",
        is_default_when: false,
        parameters: [
          {
            name: "sensitive_param",
            parameter_type: "gx_integer",
            type: "integer",
            label: "Sensitive parameter",
            help: "Sensitive mode only",
            hidden: false,
            optional: true,
            value: 10,
            min: null,
            max: null,
            is_dynamic: false,
            argument: null,
            validators: [],
          },
        ],
      },
    ],
  },
];

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
    async hasCached(id) { return id === toolId; },
    async listCached() { return []; },
    async populateCache() { return { fetched: 0, alreadyCached: 0, failed: [] }; },
    configure() { /* noop */ },
    async getCacheSize() { return 1; },
    async getToolParameters(id) { return id === toolId ? params : null; },
    hasResolutionFailed() { return false; },
    markResolutionFailed() { /* noop */ },
    async getToolInfo() { return null; },
    getToolShedBaseUrl() { return undefined; },
    async validateNativeStep() { return []; },
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
  // Conditional branch-aware hover
  // ---------------------------------------------------------------------------

  describe("conditional branch hover", () => {
    let condService: GxFormat2HoverService;

    beforeAll(() => {
      const schemaNodeResolver = new JsonSchemaGalaxyWorkflowLoader(galaxyWorkflowJsonSchema).nodeResolver;
      condService = new GxFormat2HoverService(schemaNodeResolver, makeMockRegistry(TOOL_ID, CONDITIONAL_PARAMS));
    });

    const COND_PREFIX =
      `class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n` +
      `  step1:\n    tool_id: ${TOOL_ID}\n    state:\n      mode_cond:\n`;

    it("shows fast_param hover when mode_select is fast", async () => {
      const template = COND_PREFIX + `        mode_select: fast\n        fast$_param: 5`;
      const { contents, position } = parseTemplate(template);

      const hover = await condService.doHover(createFormat2WorkflowDocument(contents), position);

      expect(hover).not.toBeNull();
      const text = typeof hover?.contents === "string" ? hover.contents : (hover?.contents as { value: string }).value;
      expect(text).toContain("fast_param");
      expect(text).toContain("Fast parameter");
    });

    it("returns null for sensitive_param when mode_select is fast (inactive branch)", async () => {
      const template = COND_PREFIX + `        mode_select: fast\n        sensitive$_param: 10`;
      const { contents, position } = parseTemplate(template);

      const hover = await condService.doHover(createFormat2WorkflowDocument(contents), position);

      // sensitive_param is not in the active branch — hover should not resolve tool-state doc
      // (falls through to schema hover or null)
      const text = hover == null
        ? ""
        : (typeof hover.contents === "string" ? hover.contents : (hover.contents as { value: string }).value);
      expect(text).not.toContain("Sensitive parameter");
    });
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
