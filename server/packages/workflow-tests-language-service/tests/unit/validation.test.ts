import { container } from "@gxwf/server-common/src/inversify.config";
import {
  Diagnostic,
  DiagnosticSeverity,
  WorkflowDataProvider,
  WorkflowInput,
  WorkflowOutput,
} from "@gxwf/server-common/src/languageTypes";
import { WorkflowTestsLanguageServiceContainerModule } from "@gxwf/workflow-tests-language-service/src/inversify.config";
import { WorkflowTestsValidationService } from "@gxwf/workflow-tests-language-service/src/services/validation";
import "reflect-metadata";
import { TYPES } from "../../src/types";
import { createGxWorkflowTestsDocument } from "../testHelpers";

describe("Workflow Tests Validation Service", () => {
  let service: WorkflowTestsValidationService;
  beforeAll(() => {
    container.load(WorkflowTestsLanguageServiceContainerModule);
    service = container.get<WorkflowTestsValidationService>(TYPES.WorkflowTestsValidationService);
  });

  async function validate(contents: string, workflowDataProvider?: WorkflowDataProvider): Promise<Diagnostic[]> {
    const documentContext = createGxWorkflowTestsDocument(contents, workflowDataProvider);
    return await service.doValidation(documentContext);
  }

  it("should warn about missing job and outputs properties", async () => {
    const testDocumentContents = `
- doc: The docs
  `;

    const diagnostics = await validate(testDocumentContents);

    expect(diagnostics.length).toBe(2);
    expect(diagnostics[0].message).toBe('Missing property "job".');
    expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Warning);
    expect(diagnostics[1].message).toBe('Missing property "outputs".');
    expect(diagnostics[1].severity).toBe(DiagnosticSeverity.Warning);
  });

  describe("Workflow Inputs/Outputs Validation", () => {
    let workflowDataProviderMock: WorkflowDataProvider;
    const FAKE_DATASET_INPUT: WorkflowInput = {
      name: "My fake dataset",
      doc: "This is a simple dataset",
      type: "data",
    };
    const FAKE_DATASET_INPUT_COLON: WorkflowInput = {
      name: "Input dataset: fake",
      doc: "This is a simple dataset with a colon in the name",
      type: "File",
    };
    const FAKE_DATASET_COLLECTION_INPUT: WorkflowInput = {
      name: "My fake collection",
      doc: "This is a collection",
      type: "collection",
    };
    const FAKE_WORKFLOW_INPUTS: WorkflowInput[] = [
      FAKE_DATASET_INPUT,
      FAKE_DATASET_COLLECTION_INPUT,
      FAKE_DATASET_INPUT_COLON,
    ];
    const FAKE_WORKFLOW_OUTPUTS: WorkflowOutput[] = [
      {
        name: "My output",
        uuid: "1234-5678-91011-1213",
      },
      {
        name: "My second output",
        uuid: "1234-5678-91011-1214",
      },
      {
        name: "My third output: with colon",
        uuid: "1234-5678-91011-1215",
      },
    ];

    beforeAll(() => {
      workflowDataProviderMock = {
        async getWorkflowInputs(_workflowDocumentUri: string) {
          return {
            inputs: FAKE_WORKFLOW_INPUTS,
          };
        },
        async getWorkflowOutputs(_workflowDocumentUri: string) {
          return {
            outputs: FAKE_WORKFLOW_OUTPUTS,
          };
        },
      };
    });

    it("should pass validation when the inputs and outputs are defined in the workflow", async () => {
      const testDocumentContents = `
- doc: The docs
  job:
    My fake dataset: data/input.txt
  outputs:
    My output: out/output.txt`;

      const diagnostics = await validate(testDocumentContents, workflowDataProviderMock);

      expect(diagnostics).not.toBeNull();
    });

    it("should error when an input is not defined in the workflow", async () => {
      const testDocumentContents = `
- doc: The docs
  job:
    Missing input: data/input.txt
  outputs:
    My output: out/output.txt`;

      const diagnostics = await validate(testDocumentContents, workflowDataProviderMock);

      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].message).toBe('Input "Missing input" is not defined in the associated workflow.');
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
    });

    it("should error when an output is not defined in the workflow", async () => {
      const testDocumentContents = `
- doc: The docs
  job:
    My fake dataset: data/input.txt
  outputs:
    Missing output: out/output.txt`;

      const diagnostics = await validate(testDocumentContents, workflowDataProviderMock);

      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].message).toBe('Output "Missing output" is not defined in the associated workflow.');
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
    });
  });
});
