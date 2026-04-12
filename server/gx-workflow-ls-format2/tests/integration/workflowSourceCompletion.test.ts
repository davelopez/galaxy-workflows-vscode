import { GalaxyWorkflowSchema } from "@galaxy-tool-util/schema";
import { getCompletionItemsLabels, parseTemplate } from "@gxwf/server-common/tests/testHelpers";
import { JSONSchema } from "effect";
import "reflect-metadata";
import { JsonSchemaGalaxyWorkflowLoader } from "../../src/schema/jsonSchemaLoader";
import { GxFormat2CompletionService } from "../../src/services/completionService";
import { createFormat2WorkflowDocument } from "../testHelpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const galaxyWorkflowJsonSchema = JSONSchema.make(GalaxyWorkflowSchema) as Record<string, unknown>;

// A two-step workflow used by most tests:
//   - first_step  has outputs: [out_file1, out_file2]
//   - second_step is where we place the cursor in in: blocks
const WORKFLOW_WITH_STEPS = `\
class: GalaxyWorkflow
inputs:
  input_data:
    type: data
  input_string:
    type: text
steps:
  first_step:
    tool_id: cat1
    in: {}
    out:
      - out_file1
      - out_file2
    state: {}
  second_step:
    tool_id: cat1
`;

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe("Workflow Connection Source Completions", () => {
  let service: GxFormat2CompletionService;

  beforeAll(() => {
    const schemaNodeResolver = new JsonSchemaGalaxyWorkflowLoader(galaxyWorkflowJsonSchema).nodeResolver;
    // No tool registry needed — source completions don't require one
    service = new GxFormat2CompletionService(schemaNodeResolver);
  });

  async function getCompletions(contents: string, position: { line: number; character: number }) {
    const documentContext = createFormat2WorkflowDocument(contents);
    return service.doComplete(documentContext, position);
  }

  // ---------------------------------------------------------------------------
  // Explicit list form  (in: [ { source: ... } ])
  // ---------------------------------------------------------------------------

  it("suggests workflow inputs in explicit source field", async () => {
    const template =
      WORKFLOW_WITH_STEPS +
      `    in:\n` +
      `      - id: query\n` +
      `        source: $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("input_data");
    expect(labels).toContain("input_string");
  });

  it("suggests upstream step outputs in explicit source field", async () => {
    const template =
      WORKFLOW_WITH_STEPS +
      `    in:\n` +
      `      - id: query\n` +
      `        source: $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("first_step/out_file1");
    expect(labels).toContain("first_step/out_file2");
  });

  it("does not suggest outputs from the current step", async () => {
    // second_step also has outputs — but we're completing inside it, so it should be excluded
    const workflowBothWithOut = `\
class: GalaxyWorkflow
inputs:
  input_data:
    type: data
steps:
  first_step:
    tool_id: cat1
    in: {}
    out:
      - out_file1
    state: {}
  second_step:
    tool_id: cat1
    out:
      - result
    in:
      - id: query
        source: $
    state: {}
`;
    const { contents, position } = parseTemplate(workflowBothWithOut);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("first_step/out_file1");
    expect(labels).not.toContain("second_step/result");
  });

  it("does not suggest outputs from steps defined after the current step (no forward references)", async () => {
    // first_step comes AFTER second_step in YAML order — must not be suggested
    const workflowReverseOrder = `\
class: GalaxyWorkflow
inputs:
  input_data:
    type: data
steps:
  second_step:
    tool_id: cat1
    in:
      - id: query
        source: $
    out: []
    state: {}
  first_step:
    tool_id: cat1
    in: {}
    out:
      - out_file1
    state: {}
`;
    const { contents, position } = parseTemplate(workflowReverseOrder);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("input_data");
    expect(labels).not.toContain("first_step/out_file1");
  });

  it("filters source suggestions by current word prefix", async () => {
    const template =
      WORKFLOW_WITH_STEPS +
      `    in:\n` +
      `      - id: query\n` +
      `        source: first$`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("first_step/out_file1");
    expect(labels).toContain("first_step/out_file2");
    expect(labels).not.toContain("input_data");
    expect(labels).not.toContain("input_string");
  });

  // ---------------------------------------------------------------------------
  // Map shorthand form  (in: { inputName: source_value })
  // ---------------------------------------------------------------------------

  it("suggests sources in map shorthand in: form", async () => {
    // Confirms the YAML parser produces ["steps","second_step","in","query"] for the
    // shorthand `in: { key: value }` form, so findSourceInPath detects it correctly.
    const template =
      WORKFLOW_WITH_STEPS +
      `    in:\n` +
      `      query: $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("input_data");
    expect(labels).toContain("input_string");
    expect(labels).toContain("first_step/out_file1");
    expect(labels).toContain("first_step/out_file2");
  });

  it("does not offer source completions at a map shorthand in: key position", async () => {
    // Cursor is at the key (input parameter name), not the value — no source completions expected
    const template =
      WORKFLOW_WITH_STEPS +
      `    in:\n` +
      `      $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    // Should not offer source labels as completions here
    expect(labels).not.toContain("input_data");
    expect(labels).not.toContain("first_step/out_file1");
  });

  // ---------------------------------------------------------------------------
  // Object-form out:  (out: { name: { ... } })
  // ---------------------------------------------------------------------------

  it("suggests outputs from object-form out:", async () => {
    const workflow = `\
class: GalaxyWorkflow
inputs:
  input_data:
    type: data
steps:
  first_step:
    tool_id: cat1
    in: {}
    out:
      out_file1:
        hide: true
      out_file2:
        rename: "renamed"
    state: {}
  second_step:
    tool_id: cat1
    in:
      - id: query
        source: $
    state: {}
`;
    const { contents, position } = parseTemplate(workflow);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("first_step/out_file1");
    expect(labels).toContain("first_step/out_file2");
    expect(labels).toContain("input_data");
  });

  it("suggests outputs from array-of-objects out:", async () => {
    const workflow = `\
class: GalaxyWorkflow
inputs: {}
steps:
  first_step:
    tool_id: cat1
    in: {}
    out:
      - id: out_file1
        hide: true
      - id: out_file2
    state: {}
  second_step:
    tool_id: cat1
    in:
      - id: query
        source: $
    state: {}
`;
    const { contents, position } = parseTemplate(workflow);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("first_step/out_file1");
    expect(labels).toContain("first_step/out_file2");
  });

  it("suggests outputs when steps use mixed out: forms", async () => {
    const workflow = `\
class: GalaxyWorkflow
inputs: {}
steps:
  array_step:
    tool_id: cat1
    in: {}
    out:
      - array_out
    state: {}
  object_step:
    tool_id: cat1
    in: {}
    out:
      object_out:
        hide: true
    state: {}
  current_step:
    tool_id: cat1
    in:
      - id: query
        source: $
    state: {}
`;
    const { contents, position } = parseTemplate(workflow);

    const completions = await getCompletions(contents, position);
    const labels = getCompletionItemsLabels(completions);

    expect(labels).toContain("array_step/array_out");
    expect(labels).toContain("object_step/object_out");
  });

  // ---------------------------------------------------------------------------
  // No upstream steps / no inputs
  // ---------------------------------------------------------------------------

  it("returns empty completions when workflow has no inputs or prior steps", async () => {
    const workflow = `\
class: GalaxyWorkflow
inputs: {}
steps:
  only_step:
    tool_id: cat1
    out: []
    in:
      - id: query
        source: $
    state: {}
`;
    const { contents, position } = parseTemplate(workflow);

    const completions = await getCompletions(contents, position);
    expect(completions.items).toHaveLength(0);
  });
});
