import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import "reflect-metadata";
import { ToolStateValidationService } from "../../src/services/toolStateValidationService";
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
    help: null,
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
    help: null,
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
    help: null,
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
    label: "Advanced",
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
  {
    name: "iterations",
    parameter_type: "gx_repeat",
    label: "Iterations",
    help: null,
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
        help: null,
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
    clearResolutionFailed() { /* noop */ },
    async getToolInfo() { return null; },
    getToolShedBaseUrl() { return undefined; },
    async validateNativeStep() { return []; },
  };
}

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
            parameter_type: "gx_integer",
            type: "integer",
            label: "Sensitive parameter",
            help: null,
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

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe("ToolStateValidationService", () => {
  let service: ToolStateValidationService;

  beforeAll(() => {
    service = new ToolStateValidationService(makeMockRegistry(TOOL_ID, TOOL_PARAMS));
  });

  const STEP_PREFIX =
    "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
    `  step1:\n    tool_id: ${TOOL_ID}\n    state:\n`;

  // ---------------------------------------------------------------------------
  // Tool not cached
  // ---------------------------------------------------------------------------

  it("emits Information diagnostic when tool is not in cache", async () => {
    const doc = createFormat2WorkflowDocument(
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
        "  step1:\n    tool_id: unknown_tool\n    state:\n      read1: foo\n"
    );
    const diagnostics = await service.doValidation(doc);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe(3); // DiagnosticSeverity.Information = 3
    expect(diagnostics[0].message).toContain("not in the local cache");
  });

  it("emits no diagnostics when step has no state block", async () => {
    const doc = createFormat2WorkflowDocument(
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
        `  step1:\n    tool_id: ${TOOL_ID}\n    in: {}\n`
    );
    const diagnostics = await service.doValidation(doc);
    expect(diagnostics).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Unknown parameter
  // ---------------------------------------------------------------------------

  it("warns on unknown top-level parameter", async () => {
    const doc = createFormat2WorkflowDocument(STEP_PREFIX + "      totally_unknown: value\n");
    const diagnostics = await service.doValidation(doc);

    expect(diagnostics.some((d) => d.message.includes("Unknown tool parameter 'totally_unknown'"))).toBe(true);
    expect(diagnostics[0].severity).toBe(2); // DiagnosticSeverity.Warning = 2
  });

  it("emits no diagnostics for valid parameter name", async () => {
    // Use a non-data param: data params (gx_data) have no valid value in format2 state
    // (they belong in `in:` connections). alignment_type with a valid option is always valid.
    const doc = createFormat2WorkflowDocument(STEP_PREFIX + "      alignment_type: end_to_end\n");
    const diagnostics = await service.doValidation(doc);
    expect(diagnostics).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Select value validation
  // ---------------------------------------------------------------------------

  it("errors on invalid select value", async () => {
    const doc = createFormat2WorkflowDocument(STEP_PREFIX + "      alignment_type: invalid_mode\n");
    const diagnostics = await service.doValidation(doc);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe(1); // DiagnosticSeverity.Error = 1
    expect(diagnostics[0].message).toContain("Invalid value 'invalid_mode'");
    expect(diagnostics[0].message).toContain("end_to_end");
  });

  it("emits no diagnostics for valid select value", async () => {
    const doc = createFormat2WorkflowDocument(STEP_PREFIX + "      alignment_type: local\n");
    const diagnostics = await service.doValidation(doc);
    expect(diagnostics).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Section validation
  // ---------------------------------------------------------------------------

  it("warns on unknown parameter inside a section", async () => {
    const doc = createFormat2WorkflowDocument(
      STEP_PREFIX + "      advanced:\n        unknown_section_param: value\n"
    );
    const diagnostics = await service.doValidation(doc);

    expect(diagnostics.some((d) => d.message.includes("Unknown tool parameter 'unknown_section_param'"))).toBe(true);
  });

  it("emits no diagnostics for valid section parameter", async () => {
    const doc = createFormat2WorkflowDocument(STEP_PREFIX + "      advanced:\n        score_min: G,20,8,2\n");
    const diagnostics = await service.doValidation(doc);
    expect(diagnostics).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Multiple steps
  // ---------------------------------------------------------------------------

  it("validates all steps in a workflow", async () => {
    const doc = createFormat2WorkflowDocument(
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
        `  step1:\n    tool_id: ${TOOL_ID}\n    state:\n      unknown1: x\n` +
        `  step2:\n    tool_id: ${TOOL_ID}\n    state:\n      unknown2: y\n`
    );
    const diagnostics = await service.doValidation(doc);

    expect(diagnostics.some((d) => d.message.includes("'unknown1'"))).toBe(true);
    expect(diagnostics.some((d) => d.message.includes("'unknown2'"))).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Repeat block validation
  // ---------------------------------------------------------------------------

  it("warns on unknown parameter inside a repeat block", async () => {
    const doc = createFormat2WorkflowDocument(
      STEP_PREFIX + "      iterations:\n        - unknown_repeat_param: value\n"
    );
    const diagnostics = await service.doValidation(doc);

    expect(diagnostics.some((d) => d.message.includes("Unknown tool parameter 'unknown_repeat_param'"))).toBe(true);
  });

  it("emits no diagnostics for valid parameter inside a repeat block", async () => {
    const doc = createFormat2WorkflowDocument(
      STEP_PREFIX + "      iterations:\n        - seed: 42\n"
    );
    const diagnostics = await service.doValidation(doc);
    expect(diagnostics).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Conditional branch filtering (A5)
  // ---------------------------------------------------------------------------

  describe("conditional branch filtering", () => {
    let condService: ToolStateValidationService;

    beforeAll(() => {
      condService = new ToolStateValidationService(makeMockRegistry(TOOL_ID, CONDITIONAL_PARAMS));
    });

    const COND_PREFIX =
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
      `  step1:\n    tool_id: ${TOOL_ID}\n    state:\n      mode_cond:\n`;

    it("warns on stale branch parameter (sensitive_param set when mode_select is fast)", async () => {
      const doc = createFormat2WorkflowDocument(
        COND_PREFIX + "        mode_select: fast\n        sensitive_param: 10\n"
      );
      const diagnostics = await condService.doValidation(doc);

      expect(diagnostics.some((d) => d.message.includes("sensitive_param"))).toBe(true);
      expect(diagnostics.some((d) => d.severity === 2 /* Warning */)).toBe(true);
    });

    it("emits no diagnostics when active branch params are clean", async () => {
      const doc = createFormat2WorkflowDocument(
        COND_PREFIX + "        mode_select: fast\n        fast_param: 5\n"
      );
      const diagnostics = await condService.doValidation(doc);

      expect(diagnostics).toHaveLength(0);
    });
  });
});
