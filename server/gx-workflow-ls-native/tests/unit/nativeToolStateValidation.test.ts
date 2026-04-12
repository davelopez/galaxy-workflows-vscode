import { ToolRegistryService, ToolStateDiagnostic } from "@gxwf/server-common/src/languageTypes";
import { NativeToolStateValidationService } from "../../src/services/nativeToolStateValidationService";
import { createNativeWorkflowDocument } from "../testHelpers";

const TOOL_ID = "toolshed.g2.bx.psu.edu/repos/devteam/bowtie2/bowtie2/2.4.4";

function makeWorkflow(toolState: string | Record<string, unknown> | undefined): string {
  const toolStateJson =
    toolState === undefined
      ? undefined
      : typeof toolState === "string"
        ? JSON.stringify(toolState) // will produce a JSON string (double-encoded)
        : JSON.stringify(toolState);

  const step: Record<string, unknown> = {
    tool_id: TOOL_ID,
    tool_version: "2.4.4",
    type: "tool",
    input_connections: {},
    workflow_outputs: [],
    uuid: "00000000-0000-0000-0000-000000000001",
  };

  if (toolState !== undefined) {
    step.tool_state =
      typeof toolState === "string"
        ? toolState // already a JSON-encoded string
        : toolState; // object
  }

  const wf = {
    a_galaxy_workflow: "true",
    format_version: "0.1",
    name: "Test Workflow",
    uuid: "00000000-0000-0000-0000-000000000000",
    steps: { "0": step },
  };

  return JSON.stringify(wf, null, 2);
}

function makeWorkflowWithObjectState(toolState: Record<string, unknown>): string {
  return makeWorkflow(toolState);
}

function makeWorkflowWithStringState(toolState: Record<string, unknown>): string {
  const wf = {
    a_galaxy_workflow: "true",
    format_version: "0.1",
    name: "Test Workflow",
    uuid: "00000000-0000-0000-0000-000000000000",
    steps: {
      "0": {
        tool_id: TOOL_ID,
        tool_version: "2.4.4",
        type: "tool",
        input_connections: {},
        workflow_outputs: [],
        uuid: "00000000-0000-0000-0000-000000000001",
        tool_state: JSON.stringify(toolState),
      },
    },
  };
  return JSON.stringify(wf, null, 2);
}

type MockValidateFn = (
  toolId: string,
  toolVersion: string | undefined,
  toolState: Record<string, unknown>,
  inputConnections?: Record<string, unknown>
) => Promise<ToolStateDiagnostic[]>;

function makeMockRegistry(
  opts: {
    cached?: boolean;
    resolutionFailed?: boolean;
    validateFn?: MockValidateFn;
  } = {}
): ToolRegistryService {
  const { cached = true, resolutionFailed = false, validateFn } = opts;
  return {
    hasCached: () => cached,
    listCached: () => [],
    async populateCache() { return { fetched: 0, alreadyCached: 0, failed: [] }; },
    configure() { /* noop */ },
    get cacheSize() { return cached ? 1 : 0; },
    async getToolParameters() { return null; },
    hasResolutionFailed: () => resolutionFailed,
    markResolutionFailed: () => { /* noop */ },
    async validateNativeStep(toolId, toolVersion, toolState, inputConnections) {
      return validateFn ? validateFn(toolId, toolVersion, toolState, inputConnections) : [];
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NativeToolStateValidationService", () => {
  // --- Cache-miss cases ---

  it("emits Information diagnostic when tool is not cached (object state)", async () => {
    const service = new NativeToolStateValidationService(
      makeMockRegistry({ cached: false, resolutionFailed: false })
    );
    const doc = createNativeWorkflowDocument(makeWorkflowWithObjectState({ key: "val" }));
    const diags = await service.doValidation(doc);

    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe(3); // DiagnosticSeverity.Information
    expect(diags[0].message).toContain("not in the local cache");
  });

  it("emits Warning diagnostic when tool resolution failed (object state)", async () => {
    const service = new NativeToolStateValidationService(
      makeMockRegistry({ cached: false, resolutionFailed: true })
    );
    const doc = createNativeWorkflowDocument(makeWorkflowWithObjectState({ key: "val" }));
    const diags = await service.doValidation(doc);

    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe(2); // DiagnosticSeverity.Warning
    expect(diags[0].message).toContain("Could not resolve tool");
  });

  it("emits Information diagnostic when tool is not cached (string state)", async () => {
    const service = new NativeToolStateValidationService(
      makeMockRegistry({ cached: false, resolutionFailed: false })
    );
    const doc = createNativeWorkflowDocument(makeWorkflowWithStringState({ key: "val" }));
    const diags = await service.doValidation(doc);

    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe(3);
    expect(diags[0].message).toContain("not in the local cache");
  });

  // --- Object state: valid / invalid ---

  it("emits no diagnostics for object tool_state when validator returns empty", async () => {
    const service = new NativeToolStateValidationService(
      makeMockRegistry({ validateFn: async () => [] })
    );
    const doc = createNativeWorkflowDocument(makeWorkflowWithObjectState({ alignment_type: "end_to_end" }));
    const diags = await service.doValidation(doc);
    expect(diags).toHaveLength(0);
  });

  it("emits Error diagnostic for invalid value in object tool_state", async () => {
    const service = new NativeToolStateValidationService(
      makeMockRegistry({
        validateFn: async () => [
          { path: "alignment_type", message: 'Expected "end_to_end", actual "bad_value"', severity: "error" },
        ],
      })
    );
    const doc = createNativeWorkflowDocument(makeWorkflowWithObjectState({ alignment_type: "bad_value" }));
    const diags = await service.doValidation(doc);

    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe(1); // DiagnosticSeverity.Error
    expect(diags[0].message).toContain("bad_value");
  });

  it("passes input_connections to validateNativeStep", async () => {
    let capturedConnections: Record<string, unknown> | undefined;
    const service = new NativeToolStateValidationService(
      makeMockRegistry({
        validateFn: async (_id, _ver, _state, inputConnections) => {
          capturedConnections = inputConnections;
          return [];
        },
      })
    );
    // Build a workflow with input_connections
    const wfWithConnections = JSON.stringify({
      a_galaxy_workflow: "true",
      format_version: "0.1",
      name: "Test",
      uuid: "00000000-0000-0000-0000-000000000000",
      steps: {
        "0": {
          tool_id: TOOL_ID,
          tool_version: "2.4.4",
          type: "tool",
          input_connections: { read1: { id: 1, output_name: "output" } },
          workflow_outputs: [],
          uuid: "00000000-0000-0000-0000-000000000001",
          tool_state: { alignment_type: "end_to_end" },
        },
      },
    });
    const doc = createNativeWorkflowDocument(wfWithConnections);
    await service.doValidation(doc);

    expect(capturedConnections).toBeDefined();
    expect(capturedConnections).toHaveProperty("read1");
  });

  // --- String state: valid / invalid / malformed ---

  it("emits a hint diagnostic for string tool_state even when validator returns empty", async () => {
    const service = new NativeToolStateValidationService(
      makeMockRegistry({ validateFn: async () => [] })
    );
    const doc = createNativeWorkflowDocument(makeWorkflowWithStringState({ alignment_type: "end_to_end" }));
    const diags = await service.doValidation(doc);
    // Always emits a hint so the "Clean workflow" quick fix is discoverable
    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe(4); // DiagnosticSeverity.Hint
    expect(diags[0].code).toBe("legacy-tool-state");
  });

  it("emits Error diagnostic pointing at string node for invalid value in string tool_state", async () => {
    const service = new NativeToolStateValidationService(
      makeMockRegistry({
        validateFn: async () => [
          { path: "alignment_type", message: 'Expected "end_to_end", actual "bad"', severity: "error" },
        ],
      })
    );
    const doc = createNativeWorkflowDocument(makeWorkflowWithStringState({ alignment_type: "bad" }));
    const diags = await service.doValidation(doc);

    // Error diagnostic + hint diagnostic (for "Clean workflow" quick fix)
    expect(diags).toHaveLength(2);
    const errorDiag = diags.find((d) => d.severity === 1);
    expect(errorDiag).toBeDefined();
    expect(errorDiag!.message).toContain("bad");
    // All string-state diagnostics share the same range (the whole string node)
    expect(diags[0].range).toEqual(diags[1].range);
  });

  it("silently skips steps with malformed JSON string tool_state", async () => {
    const wf = JSON.stringify({
      a_galaxy_workflow: "true",
      format_version: "0.1",
      name: "Test",
      uuid: "00000000-0000-0000-0000-000000000000",
      steps: {
        "0": {
          tool_id: TOOL_ID,
          tool_version: "2.4.4",
          type: "tool",
          input_connections: {},
          workflow_outputs: [],
          uuid: "00000000-0000-0000-0000-000000000001",
          tool_state: "{not valid json",
        },
      },
    });
    const service = new NativeToolStateValidationService(makeMockRegistry());
    const doc = createNativeWorkflowDocument(wf);
    const diags = await service.doValidation(doc);
    expect(diags).toHaveLength(0);
  });

  // --- No tool_state ---

  it("emits no diagnostics when step has no tool_state", async () => {
    const wf = JSON.stringify({
      a_galaxy_workflow: "true",
      format_version: "0.1",
      name: "Test",
      uuid: "00000000-0000-0000-0000-000000000000",
      steps: {
        "0": {
          tool_id: TOOL_ID,
          tool_version: "2.4.4",
          type: "tool",
          input_connections: {},
          workflow_outputs: [],
          uuid: "00000000-0000-0000-0000-000000000001",
        },
      },
    });
    const service = new NativeToolStateValidationService(makeMockRegistry());
    const doc = createNativeWorkflowDocument(wf);
    const diags = await service.doValidation(doc);
    expect(diags).toHaveLength(0);
  });
});
