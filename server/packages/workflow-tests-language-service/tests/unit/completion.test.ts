import { container } from "@gxwf/server-common/src/inversify.config";
import { CompletionItem, CompletionList, WorkflowDataProvider } from "@gxwf/server-common/src/languageTypes";
import { WorkflowInput } from "@gxwf/server-common/src/services/requestsDefinitions";
import { WorkflowTestsLanguageServiceContainerModule } from "@gxwf/workflow-tests-language-service/src/inversify.config";
import "reflect-metadata";
import { WorkflowTestsSchemaService } from "../../src/schema/service";
import { YAMLCompletionHelper } from "../../src/services/completion/helper";
import { TYPES } from "../../src/types";
import { createGxWorkflowTestsDocument } from "../testHelpers";

describe("Workflow Tests Completion Service", () => {
  let helper: YAMLCompletionHelper;
  beforeAll(() => {
    container.load(WorkflowTestsLanguageServiceContainerModule);
    const schemaService = container.get<WorkflowTestsSchemaService>(TYPES.WorkflowTestsSchemaService);
    helper = new YAMLCompletionHelper(schemaService);
  });

  async function getCompletions(
    contents: string,
    position: { line: number; character: number },
    workflowDataProvider?: WorkflowDataProvider
  ): Promise<CompletionList | null> {
    const documentContext = createGxWorkflowTestsDocument(contents, workflowDataProvider);

    return await helper.doComplete(documentContext, position);
  }

  it("should suggest the `New Workflow Test` when the document is empty", async () => {
    const contents = "";
    const position = { line: 0, character: 0 };

    const completions = await getCompletions(contents, position);

    expect(completions).not.toBeNull();
    expect(completions?.items.length).toBe(1);

    expect(completions?.items[0].labelDetails?.detail).toBe("New Workflow Test");
    expect(completions?.items[0].label).toBe("- doc:");
  });

  it("should suggest the `New Workflow Test` when the document starts with dash", async () => {
    const contents = "-";
    const position = { line: 0, character: 1 };

    const completions = await getCompletions(contents, position);

    expect(completions).not.toBeNull();
    expect(completions?.items.length).toBe(1);

    expect(completions?.items[0].labelDetails?.detail).toBe("New Workflow Test");
    expect(completions?.items[0].label).toBe("- doc:");
  });

  it("should suggest the `New Workflow Test` when the position is at the beginning of a new line", async () => {
    const contents = "- doc:\n\n\n";
    const position = { line: 1, character: 0 };

    const completions = await getCompletions(contents, position);

    expect(completions).not.toBeNull();
    expect(completions?.items.length).toBe(1);

    expect(completions?.items[0].labelDetails?.detail).toBe("New Workflow Test");
    expect(completions?.items[0].label).toBe("- doc:");
  });

  it("should suggest the `job` and `outputs` entries when the position is at the same level as `doc`", async () => {
    const template = `
- doc: The docs
  $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions).not.toBeNull();
    expect(completions?.items.length).toBe(2);
    const jobCompletion = completions?.items.find((item) => item.label === "job");
    const outputCompletion = completions?.items.find((item) => item.label === "outputs");
    expect(jobCompletion).toBeDefined();
    expect(outputCompletion).toBeDefined();
  });

  it("should suggest the `job` entry as first suggestion when the position is at the Test definition level and starts with a `j`", async () => {
    const template = `
- doc: The docs
  j$`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions).not.toBeNull();
    const jobCompletion = completions!.items[0]!;
    expect(jobCompletion.label).toBe("job");
  });

  describe("Workflow Inputs Completion", () => {
    let workflowDataProviderMock: WorkflowDataProvider;
    const FAKE_DATASET_INPUT: WorkflowInput = {
      name: "My fake dataset",
      description: "This is a simple dataset",
      type: "data_input",
    };
    const FAKE_DATASET_COLLECTION_INPUT: WorkflowInput = {
      name: "My fake collection",
      description: "This is a collection",
      type: "data_collection_input",
    };
    const FAKE_WORKFLOW_INPUTS: WorkflowInput[] = [FAKE_DATASET_INPUT, FAKE_DATASET_COLLECTION_INPUT];

    beforeAll(() => {
      workflowDataProviderMock = {
        async getWorkflowInputs(_workflowDocumentUri: string) {
          return {
            inputs: FAKE_WORKFLOW_INPUTS,
          };
        },
      };
    });

    it("should suggest all the defined inputs of the workflow when no inputs are defined in the test", async () => {
      const template = `
- doc: The docs
  job:
    $`;
      const { contents, position } = parseTemplate(template);

      const completions = await getCompletions(contents, position, workflowDataProviderMock);

      expect(completions).not.toBeNull();
      expect(completions?.items.length).toBe(FAKE_WORKFLOW_INPUTS.length);
      for (let index = 0; index < FAKE_WORKFLOW_INPUTS.length; index++) {
        const workflowInput = FAKE_WORKFLOW_INPUTS[index];
        const completionItem = completions!.items[index];
        expectCompletionItemToMatchWorkflowInput(completionItem, workflowInput);
      }
    });

    it("should not suggest an existing input when suggesting inputs", async () => {
      const existingInput = FAKE_DATASET_INPUT;
      const expectedNumOfRemainingInputs = FAKE_WORKFLOW_INPUTS.length - 1;
      const template = `
- doc: The docs
  job:
    ${existingInput.name}:
    $`;
      const { contents, position } = parseTemplate(template);

      const completions = await getCompletions(contents, position, workflowDataProviderMock);

      expect(completions).not.toBeNull();
      expect(completions?.items.length).toBe(expectedNumOfRemainingInputs);
      const existingTestInput = completions?.items.find((item) => item.label === existingInput.name);
      expect(existingTestInput).toBeUndefined();
    });

    describe("Dataset Input Completions", () => {
      it("should suggest the File class if there is nothing defined", async () => {
        const datasetInput = FAKE_DATASET_INPUT;
        const template = `
- doc: The docs
  job:
    ${datasetInput.name}:
      $`;
        const { contents, position } = parseTemplate(template);

        const completions = await getCompletions(contents, position, workflowDataProviderMock);

        expect(completions).not.toBeNull();
        expect(completions?.items.length).toBe(1);
        expect(completions?.items[0].label).toBe("class");
        expect(completions?.items[0].insertText).toBe("class: File");
      });
    });
  });
});

function parseTemplate(
  template: string,
  char?: string
): { contents: string; position: { line: number; character: number } } {
  if (!char) {
    char = "$";
  }
  let position = { line: 0, character: 0 };
  const contents = template.replace(char, "");

  const lines = template.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const character = lines[i].indexOf(char);
    if (character !== -1) {
      position = { line: i, character };
      return { contents, position };
    }
  }

  return { contents, position };
}

function expectCompletionItemDocumentationToContain(completionItem: CompletionItem, value: string): void {
  expect(completionItem.documentation).toBeDefined();
  if (typeof completionItem.documentation === "string") {
    expect(completionItem.documentation).toContain(value);
  } else {
    expect(completionItem.documentation?.value).toContain(value);
  }
}

function expectCompletionItemToMatchWorkflowInput(completionItem: CompletionItem, workflowInput: WorkflowInput): void {
  expect(completionItem.label).toEqual(workflowInput.name);
  expectCompletionItemDocumentationToContain(completionItem, workflowInput.description);
}
