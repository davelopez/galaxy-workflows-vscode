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
  describe("getWorkflowInputs", () => {
    it.each([
      ["", 0],
      [TestWorkflowProvider.workflows.validation.withoutSteps, 0],
      [TestWorkflowProvider.workflows.validation.withOneStep, 1],
      [TestWorkflowProvider.workflows.validation.withThreeSteps, 2],
      [TestWorkflowProvider.workflows.validation.withWorkflowOutputLabels, 1],
      [TestWorkflowProvider.workflows.validation.withoutWorkflowOutputLabels, 1],
    ])("returns the expected number of inputs", (wf_content: string, expectedNumInputs: number) => {
      const document = createNativeWorkflowDocument(wf_content);
      const result = document.getWorkflowInputs();
      expect(result.inputs).toHaveLength(expectedNumInputs);
    });

    it("should return the expected information of the inputs", () => {
      const document = createNativeWorkflowDocument(TestWorkflowProvider.workflows.validation.withThreeSteps);
      const result = document.getWorkflowInputs();
      expect(result.inputs).toHaveLength(2);
      expect(result.inputs).toEqual([
        {
          name: "WorkflowInput1",
          doc: "input1 description",
          type: "data",
        },
        {
          name: "WorkflowInput2",
          doc: "",
          type: "data",
        },
      ]);
    });
  });
});
