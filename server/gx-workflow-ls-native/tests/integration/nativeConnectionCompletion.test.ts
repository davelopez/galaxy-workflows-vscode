import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { getCompletionItemsLabels, parseTemplate } from "@gxwf/server-common/tests/testHelpers";
import "reflect-metadata";
import { NativeWorkflowConnectionService } from "../../src/services/nativeWorkflowConnectionService";
import { createNativeWorkflowDocument } from "../testHelpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TOOL_ID = "toolshed.g2.bx.psu.edu/repos/devteam/bowtie2/bowtie2/2.4.4";

const TOOL_PARAMS_BOWTIE = [
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
    name: "reference",
    parameter_type: "gx_data",
    type: "data",
    label: "Reference genome",
    help: null,
    hidden: false,
    optional: false,
    multiple: false,
    extensions: ["fasta"],
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
    async validateNativeStep() { return []; },
  };
}

// ---------------------------------------------------------------------------
// Workflow fixture with three steps:
//   step 0: data_input (produces "output")
//   step 1: data_input (produces "output")
//   step 2: tool (bowtie2) — has input_connections, cursor goes here
// ---------------------------------------------------------------------------

function makeMultiStepWorkflow(inputConnections: string): string {
  return `{
  "a_galaxy_workflow": "true",
  "steps": {
    "0": {
      "id": 0,
      "type": "data_input",
      "label": "reads",
      "tool_state": {"optional": false},
      "input_connections": {},
      "outputs": []
    },
    "1": {
      "id": 1,
      "type": "data_input",
      "label": "genome",
      "tool_state": {"optional": false},
      "input_connections": {},
      "outputs": []
    },
    "2": {
      "id": 2,
      "type": "tool",
      "tool_id": "${TOOL_ID}",
      "tool_version": "2.4.4",
      "tool_state": {},
      "input_connections": {${inputConnections}},
      "outputs": [{"name": "bam_output"}, {"name": "log"}]
    }
  }
}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Native Workflow Connection Service", () => {
  let service: NativeWorkflowConnectionService;

  beforeAll(() => {
    service = new NativeWorkflowConnectionService(makeMockRegistry(TOOL_ID, TOOL_PARAMS_BOWTIE));
  });

  // ---------------------------------------------------------------------------
  // Key completion: suggest parameter names for input_connections
  // ---------------------------------------------------------------------------

  it("suggests connectable parameter names as input_connections keys", async () => {
    const workflow = makeMultiStepWorkflow(`\n        $\n      `);
    const { contents, position } = parseTemplate(workflow);
    const doc = createNativeWorkflowDocument(contents);
    const completions = await service.doCompleteAt(doc, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("read1");
    expect(labels).toContain("reference");
  });

  // ---------------------------------------------------------------------------
  // ID completion: suggest step IDs for input_connections[paramName].id
  // ---------------------------------------------------------------------------

  it("suggests available upstream step IDs for .id field", async () => {
    const workflow = makeMultiStepWorkflow(
      `\n        "read1": {"id": $, "output_name": "output"}\n      `
    );
    const { contents, position } = parseTemplate(workflow);
    const doc = createNativeWorkflowDocument(contents);
    const completions = await service.doCompleteAt(doc, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("0");
    expect(labels).toContain("1");
    // Step 2 is the current step — no forward self-reference
    expect(labels).not.toContain("2");
  });

  it("does not include current step ID (no self-reference)", async () => {
    const workflow = makeMultiStepWorkflow(
      `\n        "read1": {"id": $, "output_name": "output"}\n      `
    );
    const { contents, position } = parseTemplate(workflow);
    const doc = createNativeWorkflowDocument(contents);
    const completions = await service.doCompleteAt(doc, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).not.toContain("2");
  });

  // ---------------------------------------------------------------------------
  // output_name completion: suggest output names from source step
  // ---------------------------------------------------------------------------

  it("suggests output names from referenced step for output_name field", async () => {
    // Step 2 has outputs "bam_output" and "log"
    // We're setting up input_connections for a DIFFERENT step (step 3) referencing step 2
    const workflow = `{
  "a_galaxy_workflow": "true",
  "steps": {
    "0": {
      "id": 0,
      "type": "data_input",
      "label": "reads",
      "tool_state": {},
      "input_connections": {},
      "outputs": []
    },
    "1": {
      "id": 1,
      "type": "tool",
      "tool_id": "${TOOL_ID}",
      "tool_version": "2.4.4",
      "tool_state": {},
      "input_connections": {},
      "outputs": [{"name": "bam_output"}, {"name": "log"}]
    },
    "2": {
      "id": 2,
      "type": "tool",
      "tool_id": "${TOOL_ID}",
      "tool_version": "2.4.4",
      "tool_state": {},
      "input_connections": {
        "read1": {"id": 1, "output_name": $}
      },
      "outputs": []
    }
  }
}`;
    const { contents, position } = parseTemplate(workflow);
    const doc = createNativeWorkflowDocument(contents);
    const completions = await service.doCompleteAt(doc, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("bam_output");
    expect(labels).toContain("log");
  });

  it("falls back to 'output' for input-type steps with no outputs array", async () => {
    // Step 0 is a data_input with empty outputs array — should fall back to ["output"]
    const workflow = makeMultiStepWorkflow(
      `\n        "read1": {"id": 0, "output_name": $}\n      `
    );
    const { contents, position } = parseTemplate(workflow);
    const doc = createNativeWorkflowDocument(contents);
    const completions = await service.doCompleteAt(doc, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("output");
  });

  // ---------------------------------------------------------------------------
  // Returns empty when not inside input_connections
  // ---------------------------------------------------------------------------

  it("returns empty completions when cursor is not in input_connections", async () => {
    const workflow = `{
  "a_galaxy_workflow": "true",
  "steps": {
    "0": {
      "id": 0,
      "type": "tool",
      "tool_id": "${TOOL_ID}",
      "tool_state": {$},
      "input_connections": {}
    }
  }
}`;
    const { contents, position } = parseTemplate(workflow);
    const doc = createNativeWorkflowDocument(contents);
    const completions = await service.doCompleteAt(doc, position);
    // Should return null/empty — not in input_connections
    expect(completions).toBeNull();
  });
});
