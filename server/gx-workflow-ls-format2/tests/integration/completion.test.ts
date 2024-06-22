import { CompletionList } from "@gxwf/server-common/src/languageTypes";
import { getCompletionItemsLabels, parseTemplate } from "@gxwf/server-common/tests/testHelpers";

import "reflect-metadata";
import { GalaxyWorkflowFormat2SchemaLoader } from "../../src/schema";
import { GxFormat2CompletionService } from "../../src/services/completionService";
import { createFormat2WorkflowDocument } from "../testHelpers";

describe("Format2 Workflow Completion Service", () => {
  let service: GxFormat2CompletionService;
  beforeAll(() => {
    const schemaNodeResolver = new GalaxyWorkflowFormat2SchemaLoader().nodeResolver;
    service = new GxFormat2CompletionService(schemaNodeResolver);
  });

  async function getCompletions(
    contents: string,
    position: { line: number; character: number }
  ): Promise<CompletionList> {
    const documentContext = createFormat2WorkflowDocument(contents);

    return await service.doComplete(documentContext, position);
  }

  it("should suggest all the basic properties of the workflow when the document is empty", async () => {
    const template = `
$`;
    const EXPECTED_COMPLETION_LABELS = [
      "class",
      "steps",
      "report",
      "tags",
      "creator",
      "license",
      "release",
      "inputs",
      "outputs",
      "id",
      "label",
      "doc",
      "uuid",
    ];
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    const completionLabels = getCompletionItemsLabels(completions);
    expect(completionLabels).toEqual(EXPECTED_COMPLETION_LABELS);
  });

  it("should suggest the `class` property if the word starts with `cl`", async () => {
    const template = `
cl$`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions?.items.length).toBe(1);
    expect(completions?.items[0].label).toBe("class");
  });

  it("should suggest the available classes for the `class` property", async () => {
    const template = `
class: $`;
    const EXPECTED_COMPLETION_LABELS = ["GalaxyWorkflow"];
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    const completionLabels = getCompletionItemsLabels(completions);
    expect(completionLabels).toEqual(EXPECTED_COMPLETION_LABELS);
  });

  it("should suggest the basic properties of the workflow that are not already defined", async () => {
    const template = `
class: GalaxyWorkflow
id: my_workflow
doc: This is a simple workflow
$`;
    const EXPECTED_COMPLETION_LABELS = [
      "steps",
      "report",
      "tags",
      "creator",
      "license",
      "release",
      "inputs",
      "outputs",
      "label",
      "uuid",
    ];
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    const completionLabels = getCompletionItemsLabels(completions);
    expect(completionLabels).toEqual(EXPECTED_COMPLETION_LABELS);
  });

  it("should suggest the `inputs` property if the word starts with `in`", async () => {
    const template = `
class: GalaxyWorkflow
in$
`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions?.items.length).toBe(1);
    expect(completions?.items[0].label).toBe("inputs");
  });

  it("should not suggest any properties when defining new workflow inputs", async () => {
    const template = `
class: GalaxyWorkflow
inputs:
  $
`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions?.items.length).toBe(0);
  });

  it("should not suggest any properties when defining new workflow outputs", async () => {
    const template = `
class: GalaxyWorkflow
outputs:
  $
`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions?.items.length).toBe(0);
  });

  it("should not suggest any properties when defining new workflow steps", async () => {
    const template = `
class: GalaxyWorkflow
steps:
  $
`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions?.items.length).toBe(0);
  });

  it("should not suggest property completions inlined with the definition", async () => {
    const template = `
class: GalaxyWorkflow
inputs:
  My input:$`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions?.items).toHaveLength(0);
  });

  it("should suggest the properties of a workflow input", async () => {
    const template = `
class: GalaxyWorkflow
inputs:
  My input:
    $`;
    const EXPECTED_COMPLETION_LABELS = [
      "type",
      "optional",
      "format",
      "collection_type",
      "default",
      "label",
      "doc",
      "id",
      "position",
    ];
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    const completionLabels = getCompletionItemsLabels(completions);
    expect(completionLabels).toEqual(EXPECTED_COMPLETION_LABELS);
  });

  it("should suggest the `type` property if the word starts with `t`", async () => {
    const template = `
class: GalaxyWorkflow
inputs:
  My input:
    t$`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions?.items.length).toBe(1);
    expect(completions?.items[0].label).toBe("type");
  });

  it("should suggest the available types for the `type` property", async () => {
    const template = `
  class: GalaxyWorkflow
  inputs:
    My input:
      type: $`;
    const EXPECTED_COMPLETION_LABELS = [
      "integer",
      "text",
      "File",
      "data",
      "collection",
      "null",
      "boolean",
      "int",
      "long",
      "float",
      "double",
      "string",
    ];
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    const completionLabels = getCompletionItemsLabels(completions);
    expect(completionLabels).toEqual(EXPECTED_COMPLETION_LABELS);
  });

  it("should suggest the correct input properties when the cursor is inside a property of a particular type", async () => {
    const template = `
class: GalaxyWorkflow
inputs:
  My input:
    type: File
    $`;
    const EXPECTED_COMPLETION_LABELS = [
      "optional",
      "format",
      "collection_type",
      "default",
      "label",
      "doc",
      "id",
      "position",
    ];
    const EXPECTED_EXISITING_PROPERTIES = ["type"];
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    const completionLabels = completions?.items.map((item) => item.label) ?? [];
    expect(completionLabels).toEqual(EXPECTED_COMPLETION_LABELS);
    expect(completionLabels).not.toContain(EXPECTED_EXISITING_PROPERTIES);
  });

  it("should suggest the correct input properties when there are other inputs defined after the cursor", async () => {
    const template = `
class: GalaxyWorkflow
inputs:
  My input:
    $
  Another input:
  `;
    const EXPECTED_COMPLETION_LABELS = [
      "type",
      "optional",
      "format",
      "collection_type",
      "default",
      "label",
      "doc",
      "id",
      "position",
    ];
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    const completionLabels = getCompletionItemsLabels(completions);
    expect(completionLabels).toEqual(EXPECTED_COMPLETION_LABELS);
  });

  it("should not suggest anythig when we are defining a workflow input", async () => {
    const template = `
class: GalaxyWorkflow
inputs:
  My$`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions?.items).toHaveLength(0);
  });

  it("should not suggest anythig when we are defining a workflow input and there are other inputs defined after the cursor", async () => {
    const template = `
class: GalaxyWorkflow
inputs:
  My$
  Another input:
  `;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions?.items).toHaveLength(0);
  });

  it("should suggest expected fields starting with `s` for a workflow step when there are other fields defined before the cursor", async () => {
    const template = `
class: GalaxyWorkflow
steps:
  my_step:
    tool: my_tool
    s$`;
    const EXPECTED_COMPLETION_LABELS = ["state"];
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    const completionLabels = getCompletionItemsLabels(completions);
    expect(completionLabels).toEqual(EXPECTED_COMPLETION_LABELS);
  });

  it("should suggest the list of available types for a step", async () => {
    const template = `
class: GalaxyWorkflow
steps:
  my_step:
    tool: my_tool
    type: $
outputs:`;
    const EXPECTED_COMPLETION_LABELS = ["tool", "subworkflow", "pause"];
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    const completionLabels = getCompletionItemsLabels(completions);
    expect(completionLabels).toEqual(EXPECTED_COMPLETION_LABELS);
  });

  it("should suggest the list of available properties for 'report' when the cursor is inside the property", async () => {
    const template = `
class: GalaxyWorkflow
report:
  $`;
    const EXPECTED_COMPLETION_LABELS = ["markdown"];
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    const completionLabels = getCompletionItemsLabels(completions);
    expect(completionLabels).toEqual(EXPECTED_COMPLETION_LABELS);
  });
});
