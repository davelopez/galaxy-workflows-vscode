import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { getLanguageService } from "@gxwf/yaml-language-service/src";
import "reflect-metadata";
import { GxFormat2WorkflowLanguageServiceImpl } from "../../src/languageService";

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
    validateNativeStep: async () => [],
  };
}

const MINIMAL_FORMAT2 = `\
class: GalaxyWorkflow
inputs: {}
outputs: {}
steps:
  step1:
    tool_id: ${TOOL_ID}
    tool_version: "${TOOL_VERSION}"
    state:
      num_threads: 4
`;

function makeService(params: unknown[] | null): GxFormat2WorkflowLanguageServiceImpl {
  const yamlLs = getLanguageService();
  const mockSymbolsProvider = { getSymbols: () => [] };
  const mockRegistry = makeMockRegistry(TOOL_ID, params);
  return new GxFormat2WorkflowLanguageServiceImpl(yamlLs as never, mockSymbolsProvider, mockRegistry);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GxFormat2WorkflowLanguageServiceImpl.convertWorkflowText", () => {
  it("throws when targetFormat is format2 (unsupported direction)", async () => {
    const service = makeService(null);
    await expect(service.convertWorkflowText(MINIMAL_FORMAT2, "format2")).rejects.toThrow(
      "Format2 service only supports conversion to native"
    );
  });

  it("converts minimal format2 YAML to native JSON", async () => {
    const service = makeService(null);
    const result = await service.convertWorkflowText(MINIMAL_FORMAT2, "native");
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("a_galaxy_workflow", "true");
    expect(parsed).toHaveProperty("steps");
  });

  it("produces valid JSON when no tools are cached (no-op resolver path)", async () => {
    const service = makeService(null);
    const result = await service.convertWorkflowText(MINIMAL_FORMAT2, "native");
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("produces valid JSON and preserves tool state when tools are cached", async () => {
    const service = makeService(SIMPLE_PARAMS);
    const result = await service.convertWorkflowText(MINIMAL_FORMAT2, "native");
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("steps");
    // The step's tool_state should contain num_threads
    const steps: Record<string, unknown> = parsed.steps;
    const stepValues = Object.values(steps);
    expect(stepValues.length).toBeGreaterThan(0);
    const firstStep = stepValues[0] as Record<string, unknown>;
    expect(firstStep).toHaveProperty("tool_id", TOOL_ID);
  });

  it("output ends with newline", async () => {
    const service = makeService(null);
    const result = await service.convertWorkflowText(MINIMAL_FORMAT2, "native");
    expect(result.endsWith("\n")).toBe(true);
  });
});
