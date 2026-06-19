/**
 * Regression test for davelopez/galaxy-workflows-vscode#88.
 *
 * gxformat2 allows `steps:` as either a MAP (keyed by label) or a LIST (array of
 * step objects with a `label`) — see test-data/yaml/validation/test_wf_05.gxwf.yml.
 * These assertions verify tool-state validation, hover, and completion resolve a
 * step's tool for LIST-form steps, including the step at index 0. MAP-form
 * assertions are controls; LIST-form assertions guard the fix.
 */
import { GalaxyWorkflowSchema } from "@galaxy-tool-util/schema";
import { Hover, ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { parseTemplate } from "@gxwf/server-common/tests/testHelpers";
import { JSONSchema } from "effect";
import "reflect-metadata";
import { JsonSchemaGalaxyWorkflowLoader } from "../../src/schema/jsonSchemaLoader";
import { GxFormat2CompletionService } from "../../src/services/completionService";
import { GxFormat2HoverService } from "../../src/services/hoverService";
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
];

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
    async validateNativeStep() {
      return [];
    },
  };
}

const galaxyWorkflowJsonSchema = JSONSchema.make(GalaxyWorkflowSchema) as Record<string, unknown>;

describe("issue #88: list-form gxformat2 steps tool detection", () => {
  let validation: ToolStateValidationService;
  let hover: GxFormat2HoverService;
  let completion: GxFormat2CompletionService;

  beforeAll(() => {
    const registry = makeMockRegistry(TOOL_ID, TOOL_PARAMS);
    validation = new ToolStateValidationService(registry);
    const schemaNodeResolver = new JsonSchemaGalaxyWorkflowLoader(galaxyWorkflowJsonSchema).nodeResolver;
    hover = new GxFormat2HoverService(schemaNodeResolver, registry);
    completion = new GxFormat2CompletionService(schemaNodeResolver, registry);
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it("MAP form: validates tool_state (control)", async () => {
    const doc = createFormat2WorkflowDocument(
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
        `  first_cat:\n    tool_id: ${TOOL_ID}\n    state:\n      alignment_type: bogus\n`
    );
    const diagnostics = await validation.doValidation(doc);
    expect(diagnostics.some((d) => d.message.includes("Invalid value 'bogus'"))).toBe(true);
  });

  it("LIST form: validates tool_state", async () => {
    const doc = createFormat2WorkflowDocument(
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
        `  - tool_id: ${TOOL_ID}\n    label: first_cat\n    state:\n      alignment_type: bogus\n`
    );
    const diagnostics = await validation.doValidation(doc);
    expect(diagnostics.some((d) => d.message.includes("Invalid value 'bogus'"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Hover
  // -------------------------------------------------------------------------

  async function getHover(contents: string, position: { line: number; character: number }): Promise<Hover | null> {
    return hover.doHover(createFormat2WorkflowDocument(contents), position);
  }

  it("MAP form: hovers over a tool_state param (control)", async () => {
    const template =
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
      `  first_cat:\n    tool_id: ${TOOL_ID}\n    state:\n      align$ment_type: local`;
    const { contents, position } = parseTemplate(template);
    const result = await getHover(contents, position);
    expect(result).not.toBeNull();
    const text = typeof result?.contents === "string" ? result.contents : (result?.contents as { value: string }).value;
    expect(text).toContain("end_to_end");
  });

  it("LIST form: hovers over a tool_state param", async () => {
    const template =
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
      `  - tool_id: ${TOOL_ID}\n    label: first_cat\n    state:\n      align$ment_type: local`;
    const { contents, position } = parseTemplate(template);
    const result = await getHover(contents, position);
    expect(result).not.toBeNull();
    const text = typeof result?.contents === "string" ? result.contents : (result?.contents as { value: string }).value;
    expect(text).toContain("end_to_end");
  });

  // -------------------------------------------------------------------------
  // Completion
  // -------------------------------------------------------------------------

  it("MAP form: completes tool_state param names (control)", async () => {
    const template =
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
      `  first_cat:\n    tool_id: ${TOOL_ID}\n    state:\n      ali$`;
    const { contents, position } = parseTemplate(template);
    const result = await completion.doComplete(createFormat2WorkflowDocument(contents), position);
    expect(result.items.map((i) => i.label)).toContain("alignment_type");
  });

  it("LIST form: completes tool_state param names", async () => {
    const template =
      "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps:\n" +
      `  - tool_id: ${TOOL_ID}\n    label: first_cat\n    state:\n      ali$`;
    const { contents, position } = parseTemplate(template);
    const result = await completion.doComplete(createFormat2WorkflowDocument(contents), position);
    expect(result.items.map((i) => i.label)).toContain("alignment_type");
  });
});
