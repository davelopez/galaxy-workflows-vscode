/**
 * Integration tests for NativeToolStateValidationService.
 *
 * Uses the real NativeToolStateValidationService with a mock ToolRegistryService
 * that returns known TOOL_PARAMS, exercising the full AST-walking → diagnostic
 * pipeline on realistic .ga workflow JSON.
 */
import { ToolRegistryService, ToolStateDiagnostic } from "@gxwf/server-common/src/languageTypes";
import { NativeToolStateValidationService } from "../../src/services/nativeToolStateValidationService";
import { createNativeWorkflowDocument } from "../testHelpers";

// ---------------------------------------------------------------------------
// Shared tool params fixture (mirrors format2 test params for parity)
// ---------------------------------------------------------------------------

const TOOL_ID = "toolshed.g2.bx.psu.edu/repos/devteam/bowtie2/bowtie2/2.4.4";

/** Diagnostics returned by the mock validator, keyed by alignment_type value. */
const SELECT_OPTIONS = ["end_to_end", "local"];

/**
 * Minimal mock that validates `alignment_type` as a select with two options.
 * Unknown keys produce an "is unexpected" diagnostic.
 */
async function mockValidate(
  _toolId: string,
  _toolVersion: string | undefined,
  toolState: Record<string, unknown>
): Promise<ToolStateDiagnostic[]> {
  const diags: ToolStateDiagnostic[] = [];

  for (const [key, val] of Object.entries(toolState)) {
    if (key === "alignment_type") {
      if (!SELECT_OPTIONS.includes(String(val))) {
        diags.push({
          path: "alignment_type",
          message: `Expected "end_to_end", actual "${String(val)}"`,
          severity: "error",
        });
        diags.push({
          path: "alignment_type",
          message: `Expected "local", actual "${String(val)}"`,
          severity: "error",
        });
      }
    } else if (key !== "__class__") {
      diags.push({
        path: key,
        message: `${key} is unexpected`,
        severity: "warning",
      });
    }
  }

  return diags;
}

function makeMockRegistry(): ToolRegistryService {
  return {
    hasCached: async (id) => id === TOOL_ID,
    listCached: async () => [],
    async populateCache() { return { fetched: 0, alreadyCached: 0, failed: [] }; },
    configure() { /* noop */ },
    async getCacheSize() { return 1; },
    async getToolParameters() { return null; },
    hasResolutionFailed: () => false,
    markResolutionFailed: () => { /* noop */ },
    clearResolutionFailed: () => { /* noop */ },
    getToolInfo: async () => null,
    getToolShedBaseUrl: () => undefined,
    validateNativeStep: mockValidate,
  };
}

// ---------------------------------------------------------------------------
// Workflow helpers
// ---------------------------------------------------------------------------

function nativeWorkflowWithObjectState(toolState: Record<string, unknown>): string {
  return JSON.stringify(
    {
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
          tool_state: toolState,
        },
      },
    },
    null,
    2
  );
}

function nativeWorkflowWithStringState(toolState: Record<string, unknown>): string {
  return JSON.stringify(
    {
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
          tool_state: JSON.stringify(toolState),
        },
      },
    },
    null,
    2
  );
}

// ---------------------------------------------------------------------------
// Tests — object tool_state (Pass A)
// ---------------------------------------------------------------------------

describe("NativeToolStateValidationService integration — object tool_state (Pass A)", () => {
  let service: NativeToolStateValidationService;

  beforeAll(() => {
    service = new NativeToolStateValidationService(makeMockRegistry());
  });

  it("emits no diagnostics for valid alignment_type", async () => {
    const doc = createNativeWorkflowDocument(nativeWorkflowWithObjectState({ alignment_type: "end_to_end" }));
    const diags = await service.doValidation(doc);
    expect(diags).toHaveLength(0);
  });

  it("emits Error with merged union message for invalid alignment_type", async () => {
    const doc = createNativeWorkflowDocument(nativeWorkflowWithObjectState({ alignment_type: "invalid" }));
    const diags = await service.doValidation(doc);

    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe(1); // DiagnosticSeverity.Error
    expect(diags[0].message).toMatch(/Invalid value 'invalid'/);
    expect(diags[0].message).toContain("end_to_end");
    expect(diags[0].message).toContain("local");
    // Range should point at the value node of "alignment_type", NOT the whole tool_state
    expect(diags[0].range).toBeDefined();
  });

  it("emits Warning for unknown top-level key", async () => {
    const doc = createNativeWorkflowDocument(nativeWorkflowWithObjectState({ totally_unknown_param: "x" }));
    const diags = await service.doValidation(doc);

    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe(2); // DiagnosticSeverity.Warning
    expect(diags[0].message).toContain("Unknown tool parameter 'totally_unknown_param'");
    // Range points at the key node, not the value
    expect(diags[0].range).toBeDefined();
  });

  it("emits diagnostics for both valid and invalid params in same step", async () => {
    const doc = createNativeWorkflowDocument(
      nativeWorkflowWithObjectState({ alignment_type: "bad", unknown_key: "x" })
    );
    const diags = await service.doValidation(doc);

    expect(diags).toHaveLength(2);
    expect(diags.some((d) => d.severity === 1 && d.message.includes("bad"))).toBe(true);
    expect(diags.some((d) => d.severity === 2 && d.message.includes("unknown_key"))).toBe(true);
  });

  it("emits Information diagnostic for uncached tool", async () => {
    const doc = createNativeWorkflowDocument(
      JSON.stringify({
        a_galaxy_workflow: "true",
        format_version: "0.1",
        name: "Test",
        uuid: "00000000-0000-0000-0000-000000000000",
        steps: {
          "0": {
            tool_id: "toolshed.g2.bx.psu.edu/repos/other/unknown/1.0",
            tool_version: "1.0",
            type: "tool",
            input_connections: {},
            workflow_outputs: [],
            uuid: "00000000-0000-0000-0000-000000000001",
            tool_state: { key: "val" },
          },
        },
      })
    );
    const diags = await service.doValidation(doc);

    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe(3); // DiagnosticSeverity.Information
    expect(diags[0].message).toContain("not in the local cache");
  });
});

// ---------------------------------------------------------------------------
// Tests — string tool_state (Pass B)
// ---------------------------------------------------------------------------

describe("NativeToolStateValidationService integration — string tool_state (Pass B)", () => {
  let service: NativeToolStateValidationService;

  beforeAll(() => {
    service = new NativeToolStateValidationService(makeMockRegistry());
  });

  it("emits a hint diagnostic for valid alignment_type in string state (clean workflow quick fix)", async () => {
    const doc = createNativeWorkflowDocument(nativeWorkflowWithStringState({ alignment_type: "local" }));
    const diags = await service.doValidation(doc);
    // Always emits a hint so the "Clean workflow" quick fix is discoverable
    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe(4); // DiagnosticSeverity.Hint
    expect(diags[0].code).toBe("legacy-tool-state");
  });

  it("emits Error for invalid alignment_type in string state", async () => {
    const doc = createNativeWorkflowDocument(nativeWorkflowWithStringState({ alignment_type: "wrong" }));
    const diags = await service.doValidation(doc);

    // Error diagnostic + hint diagnostic (for "Clean workflow" quick fix)
    expect(diags).toHaveLength(2);
    const errorDiag = diags.find((d) => d.severity === 1);
    expect(errorDiag).toBeDefined();
    expect(errorDiag!.message).toMatch(/Invalid value 'wrong'/);
  });

  it("all diagnostics in string-state pass share the same range (the whole string node)", async () => {
    // Errors, warnings, and hint all point at the same tool_state string node
    const doc = createNativeWorkflowDocument(
      nativeWorkflowWithStringState({ alignment_type: "wrong", unknown_key: "x" })
    );
    const diags = await service.doValidation(doc);
    // 2 param errors + 1 hint
    expect(diags).toHaveLength(3);
    // All diagnostics must have the exact same range
    expect(diags[0].range).toEqual(diags[1].range);
    expect(diags[1].range).toEqual(diags[2].range);
  });

  it("produces no diagnostics for malformed JSON string state", async () => {
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
    const doc = createNativeWorkflowDocument(wf);
    const diags = await service.doValidation(doc);
    expect(diags).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — both passes in same document
// ---------------------------------------------------------------------------

describe("NativeToolStateValidationService integration — mixed document", () => {
  it("handles steps with both string and object tool_state in same document", async () => {
    const service = new NativeToolStateValidationService(makeMockRegistry());
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
          // Pass A: object state with valid value → no diagnostics
          tool_state: { alignment_type: "end_to_end" },
        },
        "1": {
          tool_id: TOOL_ID,
          tool_version: "2.4.4",
          type: "tool",
          input_connections: {},
          workflow_outputs: [],
          uuid: "00000000-0000-0000-0000-000000000002",
          // Pass B: string state with invalid value → error + hint
          tool_state: JSON.stringify({ alignment_type: "bad" }),
        },
      },
    });
    const doc = createNativeWorkflowDocument(wf);
    const diags = await service.doValidation(doc);

    // Pass A step: no diags; Pass B step: 1 error + 1 hint
    expect(diags).toHaveLength(2);
    const errorDiag = diags.find((d) => d.severity === 1);
    expect(errorDiag).toBeDefined();
    expect(errorDiag!.message).toContain("bad");
  });
});
