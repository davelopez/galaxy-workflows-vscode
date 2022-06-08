import { createNativeWorkflowDocument } from "../testHelpers";
import { TestWorkflowProvider } from "../../testWorkflowProvider";

describe("NativeWorkflowDocument", () => {
  describe("getStepNodes", () => {
    it.each([
      ["", 0],
      [TestWorkflowProvider.nativeJson.validation.withoutSteps, 0],
      [TestWorkflowProvider.nativeJson.validation.withOneStep, 1],
      [TestWorkflowProvider.nativeJson.validation.withThreeSteps, 3],
    ])("returns the expected number of steps", (wf_content: string, expectedNumSteps: number) => {
      const wfDocument = createNativeWorkflowDocument(wf_content);
      const stepNodes = wfDocument.getStepNodes();
      expect(stepNodes).toHaveLength(expectedNumSteps);
    });
  });
});
