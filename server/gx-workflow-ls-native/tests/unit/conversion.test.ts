import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import "reflect-metadata";
import { NativeWorkflowLanguageServiceImpl } from "../../src/languageService";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TOOL_ID = "toolshed.g2.bx.psu.edu/repos/devteam/bowtie2/bowtie2/2.4.4";
const TOOL_VERSION = "2.4.4";

const SIMPLE_PARAMS = [
  {
    name: "num_threads",
    parameter_type: "gx_integer",
    type: "integer",
    label: "Threads",
    help: null,
    hidden: false,
    optional: true,
    value: 1,
    min: null,
    max: null,
    is_dynamic: false,
    argument: null,
    validators: [],
  },
];

function makeMockRegistry(toolId: string, params: unknown[] | null): ToolRegistryService {
  return {
    hasCached: async (id) => id === toolId,
    listCached: async () => [],
    async populateCache() {
      return { fetched: 0, alreadyCached: 0, failed: [] };
    },
    configure() {
      /* noop */
    },
    async getCacheSize() { return params ? 1 : 0; },
    async getToolParameters(id) {
      return id === toolId ? params : null;
    },
    hasResolutionFailed: () => false,
    markResolutionFailed: () => {
      /* noop */
    },
    clearResolutionFailed: () => {
      /* noop */
    },
    getToolInfo: async () => null,
    getToolShedBaseUrl: () => undefined,
    validateNativeStep: async () => [],
  };
}

// Minimal native .ga workflow — steps is an array
const MINIMAL_NATIVE = JSON.stringify(
  {
    a_galaxy_workflow: "true",
    format_version: "0.1",
    name: "Test Workflow",
    uuid: "00000000-0000-0000-0000-000000000000",
    annotation: "",
    tags: [],
    steps: {
      "0": {
        id: 0,
        type: "tool",
        tool_id: TOOL_ID,
        tool_version: TOOL_VERSION,
        tool_state: JSON.stringify({ num_threads: 4 }),
        label: null,
        annotation: "",
        input_connections: {},
        outputs: [],
        post_job_actions: {},
        workflow_outputs: [],
        errors: null,
      },
    },
  },
  null,
  4
);

function makeService(params: unknown[] | null): NativeWorkflowLanguageServiceImpl {
  const mockSymbolsProvider = { getSymbols: () => [] };
  const mockRegistry = makeMockRegistry(TOOL_ID, params);
  return new NativeWorkflowLanguageServiceImpl(mockSymbolsProvider, mockRegistry);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NativeWorkflowLanguageServiceImpl.convertWorkflowText", () => {
  it("throws when targetFormat is native (unsupported direction)", async () => {
    const service = makeService(null);
    await expect(service.convertWorkflowText(MINIMAL_NATIVE, "native")).rejects.toThrow(
      "Native service only supports conversion to format2"
    );
  });

  it("converts minimal native JSON to format2 YAML", async () => {
    const service = makeService(null);
    const result = await service.convertWorkflowText(MINIMAL_NATIVE, "format2");
    expect(typeof result).toBe("string");
    expect(result).toContain("class: GalaxyWorkflow");
    expect(result).toContain("steps:");
  });

  it("produces valid YAML when no tools are cached (no-op resolver path)", async () => {
    const service = makeService(null);
    const result = await service.convertWorkflowText(MINIMAL_NATIVE, "format2");
    // Should parse without throwing
    const { parse } = await import("yaml");
    expect(() => parse(result)).not.toThrow();
  });

  it("produces valid YAML and includes tool step when tools are cached", async () => {
    const service = makeService(SIMPLE_PARAMS);
    const result = await service.convertWorkflowText(MINIMAL_NATIVE, "format2");
    const { parse } = await import("yaml");
    const parsed = parse(result) as Record<string, unknown>;
    expect(parsed).toHaveProperty("steps");
    const steps = parsed.steps as Record<string, unknown>;
    const stepValues = Object.values(steps);
    expect(stepValues.length).toBeGreaterThan(0);
    const firstStep = stepValues[0] as Record<string, unknown>;
    expect(firstStep).toHaveProperty("tool_id", TOOL_ID);
  });
});
