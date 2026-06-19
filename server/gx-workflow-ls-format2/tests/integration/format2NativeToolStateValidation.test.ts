/**
 * A format2 step may carry a raw native `tool_state` block (inline
 * RuntimeValue/ConnectedValue markers, double-encoded scalars) instead of a
 * schema-aware `state` block. Such a block must validate against the NATIVE
 * model, not the format2 model — otherwise inline markers and double-encoded
 * scalars are false-positive failures. Schema-aware `state` blocks must still
 * validate against the format2 model.
 *
 * See jmchilton/galaxy-tool-util-ts#114.
 */
import { ToolStateDiagnostic, validateNativeStepState } from "@galaxy-tool-util/schema";
import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import "reflect-metadata";
import { ToolStateValidationService } from "../../src/services/toolStateValidationService";
import { createFormat2WorkflowDocument } from "../testHelpers";

const TOOL_ID = "cat1";

const TOOL_PARAMS = [
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
];

// Mock registry whose validateNativeStep delegates to the real native-model
// validator so this is a faithful end-to-end repro of the routing.
function makeMockRegistry(toolId: string, params: unknown[]): ToolRegistryService {
  return {
    async hasCached(id) {
      return id === toolId;
    },
    async listCached() {
      return [];
    },
    async populateCache() {
      return { fetched: 0, alreadyCached: 0, failed: [] };
    },
    configure() {},
    async getCacheSize() {
      return 1;
    },
    async getToolParameters(id) {
      return id === toolId ? params : null;
    },
    hasResolutionFailed() {
      return false;
    },
    markResolutionFailed() {},
    clearResolutionFailed() {},
    async getToolInfo() {
      return null;
    },
    getToolShedBaseUrl() {
      return undefined;
    },
    async validateNativeStep(id, _version, toolState, inputConnections) {
      if (id !== toolId) return [];
      try {
        validateNativeStepState(params as never, toolState, inputConnections);
        return [];
      } catch (e: unknown) {
        const issues = (e as { issues?: string[] }).issues ?? [String(e)];
        return issues.map<ToolStateDiagnostic>((message) => ({ path: "", message, severity: "error" }));
      }
    },
  };
}

describe("format2 native-shaped tool_state validation", () => {
  let service: ToolStateValidationService;

  beforeAll(() => {
    service = new ToolStateValidationService(makeMockRegistry(TOOL_ID, TOOL_PARAMS));
  });

  it("accepts an inline RuntimeValue in a native tool_state block", async () => {
    const doc = createFormat2WorkflowDocument(
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
        `  step1:\n    tool_id: ${TOOL_ID}\n    tool_state:\n      alignment_type:\n        __class__: RuntimeValue\n`
    );
    const diagnostics = await service.doValidation(doc);
    expect(diagnostics).toHaveLength(0);
  });

  it("accepts a double-encoded boolean scalar in a native tool_state block", async () => {
    const doc = createFormat2WorkflowDocument(
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
        `  step1:\n    tool_id: ${TOOL_ID}\n    tool_state:\n      paired_end: "true"\n`
    );
    const diagnostics = await service.doValidation(doc);
    expect(diagnostics).toHaveLength(0);
  });

  it("still validates a schema-aware format2 state block against the format2 model", async () => {
    const doc = createFormat2WorkflowDocument(
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
        `  step1:\n    tool_id: ${TOOL_ID}\n    state:\n      alignment_type: bogus\n`
    );
    const diagnostics = await service.doValidation(doc);
    expect(diagnostics.some((d) => d.message.includes("Invalid value 'bogus'"))).toBe(true);
  });
});

// A required data param that has no value in tool_state — only an upstream
// connection can satisfy it. Native .ga output records that as an inline
// ConnectedValue marker, but in a gxformat2 file the connection lives in the
// step's `in:` block instead, so the native validator must be told about it.
const DATA_TOOL_ID = "cat1";
const DATA_TOOL_PARAMS = [
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
];

describe("format2 native tool_state with a connected required param (gap 3)", () => {
  let service: ToolStateValidationService;

  beforeAll(() => {
    service = new ToolStateValidationService(makeMockRegistry(DATA_TOOL_ID, DATA_TOOL_PARAMS));
  });

  it("does not flag a required param satisfied by an `in:` connection (map shorthand)", async () => {
    const doc = createFormat2WorkflowDocument(
      "class: GalaxyWorkflow\ninputs:\n  upstream:\n    type: data\noutputs: {}\nsteps:\n" +
        `  step1:\n    tool_id: ${DATA_TOOL_ID}\n    tool_state: {}\n    in:\n      read1:\n        source: upstream\n`
    );
    const diagnostics = await service.doValidation(doc);
    expect(diagnostics).toHaveLength(0);
  });

  it("does not flag a required param satisfied by an `in:` connection (bare-string shorthand)", async () => {
    const doc = createFormat2WorkflowDocument(
      "class: GalaxyWorkflow\ninputs:\n  upstream:\n    type: data\noutputs: {}\nsteps:\n" +
        `  step1:\n    tool_id: ${DATA_TOOL_ID}\n    tool_state: {}\n    in:\n      read1: upstream\n`
    );
    const diagnostics = await service.doValidation(doc);
    expect(diagnostics).toHaveLength(0);
  });

  it("does not flag a required param satisfied by an `in:` connection (explicit list)", async () => {
    const doc = createFormat2WorkflowDocument(
      "class: GalaxyWorkflow\ninputs:\n  upstream:\n    type: data\noutputs: {}\nsteps:\n" +
        `  step1:\n    tool_id: ${DATA_TOOL_ID}\n    tool_state: {}\n    in:\n      - id: read1\n        source: upstream\n`
    );
    const diagnostics = await service.doValidation(doc);
    expect(diagnostics).toHaveLength(0);
  });

  it("still flags a required param that is neither set nor connected", async () => {
    const doc = createFormat2WorkflowDocument(
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
        `  step1:\n    tool_id: ${DATA_TOOL_ID}\n    tool_state: {}\n`
    );
    const diagnostics = await service.doValidation(doc);
    expect(diagnostics.some((d) => d.message.includes("read1"))).toBe(true);
  });
});
