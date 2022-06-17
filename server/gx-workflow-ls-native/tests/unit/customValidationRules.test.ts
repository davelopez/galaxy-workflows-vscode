import { createNativeWorkflowDocument } from "../testHelpers";
import { WorkflowOutputLabelValidation } from "@gxwf/server-common/src/providers/validation/WorkflowOutputLabelValidation";
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
});
