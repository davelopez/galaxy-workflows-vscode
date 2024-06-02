import { container } from "@gxwf/server-common/src/inversify.config";
import {
  CompletionItem,
  CompletionList,
  WorkflowDataProvider,
  WorkflowInput,
} from "@gxwf/server-common/src/languageTypes";
import {
  EXPECTED_WORKFLOW_INPUTS,
  EXPECTED_WORKFLOW_OUTPUTS,
  FAKE_DATASET_INPUT,
  FAKE_WORKFLOW_DATA_PROVIDER,
  expectCompletionItemDocumentationToContain,
  parseTemplate,
} from "@gxwf/server-common/tests/testHelpers";
import { WorkflowTestsLanguageServiceContainerModule } from "@gxwf/workflow-tests-language-service/src/inversify.config";
import { WorkflowTestsSchemaService } from "@gxwf/workflow-tests-language-service/src/schema/service";
import { YAMLCompletionHelper } from "@gxwf/workflow-tests-language-service/src/services/completion/helper";
import { TYPES } from "@gxwf/workflow-tests-language-service/src/types";
import "reflect-metadata";
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
    workflowDataProvider: WorkflowDataProvider = FAKE_WORKFLOW_DATA_PROVIDER
  ): Promise<CompletionList> {
    const documentContext = createGxWorkflowTestsDocument(contents, workflowDataProvider);

    return await helper.doComplete(documentContext, position);
  }

  it("should suggest the `New Workflow Test` when the document is empty", async () => {
    const contents = "";
    const position = { line: 0, character: 0 };

    const completions = await getCompletions(contents, position);

    expect(completions?.items.length).toBe(1);

    expect(completions?.items[0].labelDetails?.detail).toBe("New Workflow Test");
    expect(completions?.items[0].label).toBe("- doc:");
  });

  it("should suggest the `New Workflow Test` when the document starts with dash", async () => {
    const contents = "-";
    const position = { line: 0, character: 1 };

    const completions = await getCompletions(contents, position);

    expect(completions?.items.length).toBe(1);

    expect(completions?.items[0].labelDetails?.detail).toBe("New Workflow Test");
    expect(completions?.items[0].label).toBe("- doc:");
  });

  it("should suggest the `New Workflow Test` when the position is at the beginning of a new line", async () => {
    const contents = "- doc:\n\n\n";
    const position = { line: 1, character: 0 };

    const completions = await getCompletions(contents, position);

    expect(completions?.items.length).toBe(1);

    expect(completions?.items[0].labelDetails?.detail).toBe("New Workflow Test");
    expect(completions?.items[0].label).toBe("- doc:");
  });

  it("should suggest the `job` and `outputs` entries when the position is at the same level as `doc`", async () => {
    const expectedLabels = ["job", "outputs"];
    const template = `
- doc: The docs
  $`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    expect(completions?.items.length).toBe(2);
    for (const completionItem of completions!.items) {
      expect(expectedLabels).toContain(completionItem.label);
    }
  });

  it("should suggest the `job` entry as first suggestion when the position is at the Test definition level and starts with a `j`", async () => {
    const template = `
- doc: The docs
  j$`;
    const { contents, position } = parseTemplate(template);

    const completions = await getCompletions(contents, position);

    const jobCompletion = completions!.items[0]!;
    expect(jobCompletion.label).toBe("job");
  });

  describe("Workflow Inputs Completion", () => {
    it("should suggest all the defined inputs of the workflow when no inputs are defined in the test", async () => {
      const template = `
- doc: The docs
  job:
    $`;
      const { contents, position } = parseTemplate(template);

      const completions = await getCompletions(contents, position);

      expect(completions?.items.length).toBe(EXPECTED_WORKFLOW_INPUTS.length);
      for (let index = 0; index < EXPECTED_WORKFLOW_INPUTS.length; index++) {
        const workflowInput = EXPECTED_WORKFLOW_INPUTS[index];
        const completionItem = completions!.items[index];
        expectCompletionItemToMatchWorkflowInput(completionItem, workflowInput);
      }
    });

    it("should suggest the input including quotes if the name contains colon", async () => {
      const template = `
- doc: The docs
  job:
    Input$`;
      const { contents, position } = parseTemplate(template);

      const completions = await getCompletions(contents, position);

      const completionItem = completions!.items.find((item) => item.label.startsWith("Input"));
      expect(completionItem).toBeDefined();
      expect(completionItem?.insertText).toBeDefined();
      const insertText = completionItem!.insertText!;
      expect(insertText.startsWith("'")).toBeTruthy();
      expect(insertText.endsWith(":")).toBeTruthy();
      expect(insertText.lastIndexOf("'")).toBe(insertText.length - 2);
    });

    it("should not suggest an existing input when suggesting inputs", async () => {
      const existingInput = FAKE_DATASET_INPUT;
      const expectedNumOfRemainingInputs = EXPECTED_WORKFLOW_INPUTS.length - 1;
      const template = `
- doc: The docs
  job:
    ${existingInput.name}:
    $`;
      const { contents, position } = parseTemplate(template);

      const completions = await getCompletions(contents, position);

      expect(completions?.items.length).toBe(expectedNumOfRemainingInputs);
      const existingTestInput = completions?.items.find((item) => item.label === existingInput.name);
      expect(existingTestInput).toBeUndefined();
    });

    describe("Dataset Input Completions", () => {
      it("should suggest the 3 possible File classes if there is nothing defined", async () => {
        const DATA_INPUT_TYPE_OPTIONS = ["PathFile", "LocationFile", "CompositeDataFile"];
        const datasetInput = FAKE_DATASET_INPUT;
        const template = `
- doc: The docs
  job:
    ${datasetInput.name}:
      $`;
        const { contents, position } = parseTemplate(template);

        const completions = await getCompletions(contents, position);

        expect(completions?.items.length).toBe(3);
        for (const completionItem of completions!.items) {
          expect(completionItem.label).toContain("class");
          expect(completionItem.insertText).toContain("class: File");
          expect(DATA_INPUT_TYPE_OPTIONS).toContain(completionItem.label.replace("class ", "").trim());
        }
      });

      it("should suggest possible attributes for a (PathFile) File input", async () => {
        const datasetInput = FAKE_DATASET_INPUT;
        const expectedAttributes = ["name", "info", "dbkey", "filetype", "deferred"];
        const template = `
- doc: The docs
  job:
    ${datasetInput.name}:
      class: File
      path: /path/to/file
      $`;
        const { contents, position } = parseTemplate(template);

        const completions = await getCompletions(contents, position);

        for (const expectedAttribute of expectedAttributes) {
          const completionItem = completions?.items.find((item) => item.label === expectedAttribute);
          expect(completionItem).toBeDefined();
        }
      });
    });
    describe("Dataset Output Completions", () => {
      it("should suggest all the defined outputs of the workflow when no outputs are defined in the test", async () => {
        const template = `
- doc: The docs
  outputs:
    $`;
        const { contents, position } = parseTemplate(template);

        const completions = await getCompletions(contents, position);

        expect(completions?.items.length).toBe(EXPECTED_WORKFLOW_OUTPUTS.length);
        for (let index = 0; index < EXPECTED_WORKFLOW_OUTPUTS.length; index++) {
          const workflowOutput = EXPECTED_WORKFLOW_OUTPUTS[index];
          const completionItem = completions!.items[index];
          expect(completionItem.label).toEqual(workflowOutput.name);
        }
      });
    });
  });
});

function expectCompletionItemToMatchWorkflowInput(completionItem: CompletionItem, workflowInput: WorkflowInput): void {
  expect(completionItem.label).toEqual(workflowInput.name);
  expectCompletionItemDocumentationToContain(completionItem, workflowInput.doc);
}
