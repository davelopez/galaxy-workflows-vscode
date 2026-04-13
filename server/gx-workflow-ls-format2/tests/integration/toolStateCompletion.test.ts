import { GalaxyWorkflowSchema } from "@galaxy-tool-util/schema";
import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { getCompletionItemsLabels, parseTemplate } from "@gxwf/server-common/tests/testHelpers";
import { JSONSchema } from "effect";
import "reflect-metadata";
import { JsonSchemaGalaxyWorkflowLoader } from "../../src/schema/jsonSchemaLoader";
import { GxFormat2CompletionService } from "../../src/services/completionService";
import { createFormat2WorkflowDocument } from "../testHelpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TOOL_ID = "toolshed.g2.bx.psu.edu/repos/devteam/bowtie2/bowtie2/2.4.4";
const TOOL_VERSION = "2.4.4";

/** Minimal tool parameter bundle for the fake tool. */
const FAKE_TOOL_PARAMS = [
  {
    name: "read1",
    parameter_type: "gx_data",
    type: "data",
    label: "Read 1",
    help: "First reads file",
    hidden: false,
    optional: false,
    multiple: false,
    extensions: ["fastq"],
    is_dynamic: false,
    argument: null,
  },
  {
    name: "num_threads",
    parameter_type: "gx_integer",
    type: "integer",
    label: "Number of threads",
    help: "How many threads to use",
    hidden: false,
    optional: true,
    value: 1,
    min: 1,
    max: null,
    is_dynamic: false,
    argument: null,
    validators: [],
  },
  {
    name: "alignment_type",
    parameter_type: "gx_select",
    type: "select",
    label: "Alignment type",
    help: "Type of alignment",
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
  {
    name: "advanced",
    parameter_type: "gx_section",
    label: "Advanced options",
    help: null,
    hidden: false,
    argument: null,
    is_dynamic: false,
    parameters: [
      {
        name: "score_min",
        parameter_type: "gx_text",
        type: "text",
        label: "Min score",
        help: "Minimum alignment score",
        hidden: false,
        optional: true,
        value: null,
        area: false,
        default_options: [],
        is_dynamic: false,
        argument: null,
        validators: [],
      },
    ],
  },
  {
    name: "hidden_param",
    parameter_type: "gx_hidden",
    type: "hidden",
    label: null,
    help: null,
    hidden: true,
    optional: false,
    value: null,
    is_dynamic: false,
    argument: null,
    validators: [],
  },
  {
    name: "iterations",
    parameter_type: "gx_repeat",
    label: "Iterations",
    help: "Repeat iterations",
    hidden: false,
    argument: null,
    is_dynamic: false,
    min: null,
    max: null,
    parameters: [
      {
        name: "seed",
        parameter_type: "gx_integer",
        type: "integer",
        label: "Seed",
        help: "Random seed",
        hidden: false,
        optional: true,
        value: 42,
        min: null,
        max: null,
        is_dynamic: false,
        argument: null,
        validators: [],
      },
    ],
  },
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
      label: "Mode",
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
            label: "Fast param",
            help: null,
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
            parameter_type: "gx_text",
            type: "text",
            label: "Sensitive param",
            help: null,
            hidden: false,
            optional: true,
            value: null,
            area: false,
            default_options: [],
            is_dynamic: false,
            argument: null,
            validators: [],
          },
        ],
      },
    ],
  },
];

/** Minimal stub of ToolRegistryService that returns fake params for one tool. */
function makeMockRegistry(toolId: string, params: unknown[]): ToolRegistryService {
  return {
    async hasCached(id) { return id === toolId; },
    async listCached() { return []; },
    async populateCache() { return { fetched: 0, alreadyCached: 0, failed: [] }; },
    configure() { /* noop */ },
    async getCacheSize() { return 1; },
    async getToolParameters(id) {
      return id === toolId ? params : null;
    },
    hasResolutionFailed() { return false; },
    markResolutionFailed() { /* noop */ },
    async validateNativeStep() { return []; },
  };
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const galaxyWorkflowJsonSchema = JSONSchema.make(GalaxyWorkflowSchema) as Record<string, unknown>;

describe("Tool State Completion Service", () => {
  let service: GxFormat2CompletionService;

  beforeAll(() => {
    const schemaNodeResolver = new JsonSchemaGalaxyWorkflowLoader(galaxyWorkflowJsonSchema).nodeResolver;
    const registry = makeMockRegistry(TOOL_ID, FAKE_TOOL_PARAMS);
    service = new GxFormat2CompletionService(schemaNodeResolver, registry);
  });

  async function getCompletions(contents: string, position: { line: number; character: number }) {
    const documentContext = createFormat2WorkflowDocument(contents);
    return await service.doComplete(documentContext, position);
  }

  const WORKFLOW_PREFIX = `\
class: GalaxyWorkflow
inputs: {}
outputs: {}
steps:
  bowtie_step:
    tool_id: ${TOOL_ID}
    tool_version: "${TOOL_VERSION}"
    in: {}
    out: []
    state:
`;

  // ---------------------------------------------------------------------------
  // Top-level parameter name completions
  // ---------------------------------------------------------------------------

  it("suggests top-level parameter names inside state block", async () => {
    const template = WORKFLOW_PREFIX + `      $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("read1");
    expect(labels).toContain("num_threads");
    expect(labels).toContain("alignment_type");
    expect(labels).toContain("paired_end");
    expect(labels).toContain("advanced");
    // Hidden params should be excluded
    expect(labels).not.toContain("hidden_param");
  });

  it("filters parameter names by current word prefix", async () => {
    const template = WORKFLOW_PREFIX + `      nu$`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("num_threads");
    expect(labels).not.toContain("read1");
    expect(labels).not.toContain("alignment_type");
  });

  it("excludes already-declared parameters from suggestions", async () => {
    const template =
      WORKFLOW_PREFIX +
      `      read1: my_input\n` +
      `      $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).not.toContain("read1");
    expect(labels).toContain("num_threads");
  });

  // ---------------------------------------------------------------------------
  // Value completions (select / boolean)
  // ---------------------------------------------------------------------------

  it("suggests select options as values for a select parameter", async () => {
    const template = WORKFLOW_PREFIX + `      alignment_type: $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("end_to_end");
    expect(labels).toContain("local");
  });

  it("filters select options by current word prefix", async () => {
    const template = WORKFLOW_PREFIX + `      alignment_type: end$`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("end_to_end");
    expect(labels).not.toContain("local");
  });

  it("suggests true/false values for boolean parameters", async () => {
    const template = WORKFLOW_PREFIX + `      paired_end: $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("true");
    expect(labels).toContain("false");
  });

  // ---------------------------------------------------------------------------
  // Section navigation
  // ---------------------------------------------------------------------------

  it("suggests parameters inside a section", async () => {
    const template = WORKFLOW_PREFIX + `      advanced:\n        $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("score_min");
    expect(labels).not.toContain("read1");
  });

  // ---------------------------------------------------------------------------
  // Tool not cached → no completions
  // ---------------------------------------------------------------------------

  it("returns no completions when tool is not in cache", async () => {
    const workflow =
      `class: GalaxyWorkflow\n` +
      `inputs: {}\noutputs: {}\nsteps:\n` +
      `  step1:\n` +
      `    tool_id: unknown_tool_not_in_cache\n` +
      `    state:\n` +
      `      $`;
    const { contents, position } = parseTemplate(workflow);

    const completions = await getCompletions(contents, position);
    expect(completions.items).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Completion items are proper LSP items
  // ---------------------------------------------------------------------------

  it("generates proper CompletionItem insertText for parameter names", async () => {
    const template = WORKFLOW_PREFIX + `      $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const readItem = completions.items.find((i) => i.label === "read1");

    expect(readItem).toBeDefined();
    expect(readItem?.insertText).toBe("read1: ");
  });

  it("includes parameter type as detail field", async () => {
    const template = WORKFLOW_PREFIX + `      $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const items = completions.items;

    expect(items.find((i) => i.label === "num_threads")?.detail).toBe("integer");
    expect(items.find((i) => i.label === "alignment_type")?.detail).toBe("select");
    expect(items.find((i) => i.label === "paired_end")?.detail).toBe("boolean");
    expect(items.find((i) => i.label === "advanced")?.detail).toBe("section");
  });

  // ---------------------------------------------------------------------------
  // tool_state key (alternate to state)
  // ---------------------------------------------------------------------------

  it("offers completions inside tool_state block (not just state)", async () => {
    const workflow =
      `class: GalaxyWorkflow\n` +
      `inputs: {}\noutputs: {}\nsteps:\n` +
      `  step1:\n` +
      `    tool_id: ${TOOL_ID}\n` +
      `    tool_state:\n` +
      `      $`;
    const { contents, position } = parseTemplate(workflow);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("read1");
    expect(labels).toContain("num_threads");
  });

  // ---------------------------------------------------------------------------
  // Repeat navigation
  // ---------------------------------------------------------------------------

  it("suggests parameters inside a repeat block", async () => {
    const template = WORKFLOW_PREFIX + `      iterations:\n        - $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("seed");
    expect(labels).not.toContain("read1");
  });

  // ---------------------------------------------------------------------------
  // Conditional parameter navigation
  // ---------------------------------------------------------------------------

  it("suggests all branch params inside a conditional when discriminator not yet set", async () => {
    // mode_cond object exists but mode_select has not been written yet
    const template = WORKFLOW_PREFIX + `      mode_cond:\n        $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    // Test parameter should be offered
    expect(labels).toContain("mode_select");
    // All branch parameters offered when discriminator is not set
    expect(labels).toContain("fast_param");
    expect(labels).toContain("sensitive_param");
  });

  it("filters to fast branch params when mode_select is 'fast'", async () => {
    const template =
      WORKFLOW_PREFIX +
      `      mode_cond:\n        mode_select: fast\n        $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("fast_param");
    expect(labels).not.toContain("sensitive_param");
  });

  it("filters to sensitive branch params when mode_select is 'sensitive'", async () => {
    const template =
      WORKFLOW_PREFIX +
      `      mode_cond:\n        mode_select: sensitive\n        $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("sensitive_param");
    expect(labels).not.toContain("fast_param");
  });
});
