import { container } from "@gxwf/server-common/src/inversify.config";
import { Diagnostic, DiagnosticSeverity, WorkflowDataProvider } from "@gxwf/server-common/src/languageTypes";
import { FAKE_WORKFLOW_DATA_PROVIDER } from "@gxwf/server-common/tests/testHelpers";
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

  async function validate(
    contents: string,
    workflowDataProvider: WorkflowDataProvider = FAKE_WORKFLOW_DATA_PROVIDER
  ): Promise<Diagnostic[]> {
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
    it("should pass validation when the inputs and outputs are defined in the workflow", async () => {
      const testDocumentContents = `
- doc: The docs
  job:
    My fake dataset: data/input.txt
  outputs:
    My output: out/output.txt`;

      const diagnostics = await validate(testDocumentContents);

      expect(diagnostics).not.toBeNull();
    });

    it("should error when an input is not defined in the workflow", async () => {
      const testDocumentContents = `
- doc: The docs
  job:
    Missing input: data/input.txt
  outputs:
    My output: out/output.txt`;

      const diagnostics = await validate(testDocumentContents);

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

      const diagnostics = await validate(testDocumentContents);

      expect(diagnostics.length).toBe(1);
      expect(diagnostics[0].message).toBe('Output "Missing output" is not defined in the associated workflow.');
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
    });
  });
});
