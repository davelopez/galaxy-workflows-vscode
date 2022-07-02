import { createNativeWorkflowDocument } from "../testHelpers";
import { TestWorkflowProvider } from "../testWorkflowProvider";

describe("NativeWorkflowDocument", () => {
  describe("getStepNodes", () => {
    it.each([
      ["", 0],
      [TestWorkflowProvider.workflows.validation.withoutSteps, 0],
      [TestWorkflowProvider.workflows.validation.withOneStep, 1],
      [TestWorkflowProvider.workflows.validation.withThreeSteps, 3],
    ])("returns the expected number of steps", (wf_content: string, expectedNumSteps: number) => {
      const wfDocument = createNativeWorkflowDocument(wf_content);
      const stepNodes = wfDocument.nodeManager.getStepNodes();
      expect(stepNodes).toHaveLength(expectedNumSteps);
    });
  });
});
