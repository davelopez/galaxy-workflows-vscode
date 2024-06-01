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
  ): Promise<CompletionList | null> {
    const documentContext = createFormat2WorkflowDocument(contents);

    return await service.doComplete(documentContext, position);
  }

  it("should suggest the basic properties of the workflow", async () => {
    const template = `
class: GalaxyWorkflow
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
      "id",
      "label",
      "doc",
      "uuid",
    ];
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions).not.toBeNull();
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

    expect(completions).not.toBeNull();
    expect(completions?.items.length).toBe(1);
    expect(completions?.items[0].label).toBe("inputs");
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

    expect(completions).not.toBeNull();
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

    expect(completions).not.toBeNull();
    expect(completions?.items.length).toBe(1);
    expect(completions?.items[0].label).toBe("type");
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

    expect(completions).not.toBeNull();
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

    expect(completions).not.toBeNull();
    const completionLabels = getCompletionItemsLabels(completions);
    expect(completionLabels).toEqual(EXPECTED_COMPLETION_LABELS);
  });
});
