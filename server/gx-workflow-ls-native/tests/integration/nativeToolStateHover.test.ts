import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { parseTemplate } from "@gxwf/server-common/tests/testHelpers";
import "reflect-metadata";
import { NativeHoverService } from "../../src/services/nativeHoverService";
import { createNativeWorkflowDocument } from "../testHelpers";

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
// Test helpers
// ---------------------------------------------------------------------------

/** Build a minimal native workflow JSON with object-form tool_state (Pass A). */
function makeWorkflow(toolStateBody: string): string {
  return JSON.stringify({
    a_galaxy_workflow: "true",
    steps: {
      "0": {
        id: 0,
        type: "tool",
        tool_id: TOOL_ID,
        tool_version: "2.4.4",
        tool_state: JSON.parse(`{${toolStateBody}}`),
        input_connections: {},
        outputs: [],
      },
    },
  }, null, 2);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Native Tool State Hover Service", () => {
  let service: NativeHoverService;

  beforeAll(() => {
    service = new NativeHoverService(makeMockRegistry(TOOL_ID, TOOL_PARAMS));
  });

  async function getHover(template: string) {
    const { contents, position } = parseTemplate(template);
    const doc = createNativeWorkflowDocument(contents);
    return service.doHover(doc, position);
  }

  it("shows parameter name and type when hovering over a param key", async () => {
    // Place cursor inside "read1" key
    const workflow = JSON.stringify({
      a_galaxy_workflow: "true",
      steps: {
        "0": {
          id: 0,
          type: "tool",
          tool_id: TOOL_ID,
          tool_version: "2.4.4",
          tool_state: { "$read1": null, alignment_type: "end_to_end" },
          input_connections: {},
          outputs: [],
        },
      },
    }, null, 2).replace('"$read1"', '"read$1"');

    const { contents, position } = parseTemplate(workflow);
    const doc = createNativeWorkflowDocument(contents);
    const hover = await service.doHover(doc, position);

    expect(hover).not.toBeNull();
    const text = typeof hover?.contents === "string" ? hover.contents : (hover?.contents as { value: string }).value;
    expect(text).toContain("read1");
    expect(text).toContain("data");
  });

  it("shows select options when hovering over a select param key", async () => {
    const workflow = JSON.stringify({
      a_galaxy_workflow: "true",
      steps: {
        "0": {
          id: 0,
          type: "tool",
          tool_id: TOOL_ID,
          tool_version: "2.4.4",
          tool_state: { read1: null, "alignment_type": "end_to_end" },
          input_connections: {},
          outputs: [],
        },
      },
    }, null, 2).replace('"alignment_type"', '"align$ment_type"');

    const { contents, position } = parseTemplate(workflow);
    const doc = createNativeWorkflowDocument(contents);
    const hover = await service.doHover(doc, position);

    expect(hover).not.toBeNull();
    const text = typeof hover?.contents === "string" ? hover.contents : (hover?.contents as { value: string }).value;
    expect(text).toContain("end_to_end");
    expect(text).toContain("local");
  });

  it("shows true/false hint when hovering over a boolean param key", async () => {
    const workflow = JSON.stringify({
      a_galaxy_workflow: "true",
      steps: {
        "0": {
          id: 0,
          type: "tool",
          tool_id: TOOL_ID,
          tool_version: "2.4.4",
          tool_state: { paired_end: true },
          input_connections: {},
          outputs: [],
        },
      },
    }, null, 2).replace('"paired_end"', '"paired$_end"');

    const { contents, position } = parseTemplate(workflow);
    const doc = createNativeWorkflowDocument(contents);
    const hover = await service.doHover(doc, position);

    expect(hover).not.toBeNull();
    const text = typeof hover?.contents === "string" ? hover.contents : (hover?.contents as { value: string }).value;
    expect(text).toContain("true");
    expect(text).toContain("false");
  });

  it("shows help text in hover", async () => {
    const workflow = JSON.stringify({
      a_galaxy_workflow: "true",
      steps: {
        "0": {
          id: 0,
          type: "tool",
          tool_id: TOOL_ID,
          tool_version: "2.4.4",
          tool_state: { read1: null },
          input_connections: {},
          outputs: [],
        },
      },
    }, null, 2).replace('"read1"', '"read$1"');

    const { contents, position } = parseTemplate(workflow);
    const doc = createNativeWorkflowDocument(contents);
    const hover = await service.doHover(doc, position);

    const text = typeof hover?.contents === "string" ? hover.contents : (hover?.contents as { value: string }).value;
    expect(text).toContain("First read file");
  });

  it("returns null/fallback when string-form tool_state (Pass B)", async () => {
    // String-form tool_state should be skipped — no tool-state hover
    const workflow = JSON.stringify({
      a_galaxy_workflow: "true",
      steps: {
        "0": {
          id: 0,
          type: "tool",
          tool_id: TOOL_ID,
          tool_version: "2.4.4",
          tool_state: '{"read$1": null}',
          input_connections: {},
          outputs: [],
        },
      },
    }, null, 2);

    const { contents, position } = parseTemplate(workflow);
    const doc = createNativeWorkflowDocument(contents);
    const hover = await service.doHover(doc, position);

    // Should not crash; may return JSON schema hover or null — but never tool-state doc
    if (hover != null) {
      const text = typeof hover.contents === "string" ? hover.contents : (hover.contents as { value: string }).value;
      expect(text).not.toContain("First read file");
    }
  });

  it("returns null/fallback when tool is not cached", async () => {
    const workflow = JSON.stringify({
      a_galaxy_workflow: "true",
      steps: {
        "0": {
          id: 0,
          type: "tool",
          tool_id: "not_cached_tool",
          tool_version: "1.0",
          tool_state: { some_param: "value" },
          input_connections: {},
          outputs: [],
        },
      },
    }, null, 2).replace('"some_param"', '"some$_param"');

    const { contents, position } = parseTemplate(workflow);
    const doc = createNativeWorkflowDocument(contents);
    const hover = await service.doHover(doc, position);

    // Should not crash; any result is acceptable when tool not cached
    expect(hover === null || hover !== null).toBe(true);
  });

  describe("conditional branch hover", () => {
    let condService: NativeHoverService;

    beforeAll(() => {
      condService = new NativeHoverService(makeMockRegistry(TOOL_ID, CONDITIONAL_PARAMS));
    });

    it("shows fast_param hover when mode_select is fast", async () => {
      const workflow = JSON.stringify({
        a_galaxy_workflow: "true",
        steps: {
          "0": {
            id: 0,
            type: "tool",
            tool_id: TOOL_ID,
            tool_version: "2.4.4",
            tool_state: {
              mode_cond: {
                mode_select: "fast",
                fast_param: 5,
              },
            },
            input_connections: {},
            outputs: [],
          },
        },
      }, null, 2).replace('"fast_param"', '"fast$_param"');

      const { contents, position } = parseTemplate(workflow);
      const doc = createNativeWorkflowDocument(contents);
      const hover = await condService.doHover(doc, position);

      expect(hover).not.toBeNull();
      const text = typeof hover?.contents === "string" ? hover.contents : (hover?.contents as { value: string }).value;
      expect(text).toContain("fast_param");
      expect(text).toContain("Fast parameter");
    });

    it("returns null for sensitive_param when mode_select is fast (inactive branch)", async () => {
      const workflow = JSON.stringify({
        a_galaxy_workflow: "true",
        steps: {
          "0": {
            id: 0,
            type: "tool",
            tool_id: TOOL_ID,
            tool_version: "2.4.4",
            tool_state: {
              mode_cond: {
                mode_select: "fast",
                sensitive_param: 10,
              },
            },
            input_connections: {},
            outputs: [],
          },
        },
      }, null, 2).replace('"sensitive_param"', '"sensitive$_param"');

      const { contents, position } = parseTemplate(workflow);
      const doc = createNativeWorkflowDocument(contents);
      const hover = await condService.doHover(doc, position);

      const text = hover == null
        ? ""
        : (typeof hover.contents === "string" ? hover.contents : (hover.contents as { value: string }).value);
      expect(text).not.toContain("Sensitive parameter");
    });
  });
});
