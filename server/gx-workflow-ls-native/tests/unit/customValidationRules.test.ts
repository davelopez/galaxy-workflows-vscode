import { DiagnosticSeverity } from "@gxwf/server-common/src/languageTypes";
import {
  MissingPropertyValidationRule,
  WorkflowOutputLabelValidation,
} from "@gxwf/server-common/src/providers/validation/rules";
import { createNativeWorkflowDocument } from "../testHelpers";
import { TestWorkflowProvider } from "../testWorkflowProvider";

describe("Custom Validation Rules", () => {
  describe("WorkflowOutputLabelValidation Rule", () => {
    let rule: WorkflowOutputLabelValidation;

    beforeEach(() => {
      rule = new WorkflowOutputLabelValidation();
    });

    it("should not provide diagnostics when there are no steps", async () => {
      const wfDocument = createNativeWorkflowDocument(TestWorkflowProvider.workflows.validation.withoutSteps);
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(0);
    });

    it("should not provide diagnostics when there are no workflow_outputs in the steps", async () => {
      const wfDocument = createNativeWorkflowDocument(TestWorkflowProvider.workflows.validation.withThreeSteps);
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(0);
    });

    it("should not provide diagnostics when the steps contains workflow_outputs with label", async () => {
      const wfDocument = createNativeWorkflowDocument(
        TestWorkflowProvider.workflows.validation.withWorkflowOutputLabels
      );
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(0);
    });

    it("should provide diagnostics when the steps contains workflow_outputs without label", async () => {
      const wfDocument = createNativeWorkflowDocument(
        TestWorkflowProvider.workflows.validation.withoutWorkflowOutputLabels
      );
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(2);
      diagnostics.forEach((diagnostic) => {
        expect(diagnostic.message).toBe("Missing label in workflow output.");
      });
    });
  });

  describe("MissingPropertyValidation Rule", () => {
    let rule: MissingPropertyValidationRule;

    beforeEach(() => {
      rule = new MissingPropertyValidationRule("release");
    });

    it("should not provide diagnostics when the property is present", async () => {
      const wfContents = `{
        "a_galaxy_workflow": "true",
        "release": "0.1",
      }`;
      const wfDocument = createNativeWorkflowDocument(wfContents);
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(0);
    });

    it("should provide error diagnostics when the property is missing", async () => {
      const wfContents = `{
        "a_galaxy_workflow": "true",
      }`;
      const wfDocument = createNativeWorkflowDocument(wfContents);
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe('Missing property "release".');
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
    });
  });
});
