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

  describe("getWorkflowOutputs", () => {
    it.each([
      ["", 0],
      [TestWorkflowProvider.workflows.validation.withoutSteps, 0],
      [TestWorkflowProvider.workflows.validation.withOneStep, 0],
      [TestWorkflowProvider.workflows.validation.withThreeSteps, 0],
      [TestWorkflowProvider.workflows.validation.withWorkflowOutputLabels, 2],
      [TestWorkflowProvider.workflows.validation.withoutWorkflowOutputLabels, 2],
    ])("returns the expected number of outputs", (wf_content: string, expectedNumInputs: number) => {
      const document = createNativeWorkflowDocument(wf_content);
      const result = document.getWorkflowOutputs();
      expect(result.outputs).toHaveLength(expectedNumInputs);
    });

    it("should return the expected information of the outputs with labels", () => {
      const document = createNativeWorkflowDocument(TestWorkflowProvider.workflows.validation.withWorkflowOutputLabels);
      const result = document.getWorkflowOutputs();
      expect(result.outputs).toHaveLength(2);
      expect(result.outputs).toEqual([
        {
          name: "The first output",
          uuid: "7f08baab-5426-427e-9640-85815d809261",
        },
        {
          name: "The second output",
          uuid: "b58fce9c-e507-4714-abfc-739607e02eed",
        },
      ]);
    });
    it("should return the expected information of the outputs without labels", () => {
      const document = createNativeWorkflowDocument(
        TestWorkflowProvider.workflows.validation.withoutWorkflowOutputLabels
      );
      const result = document.getWorkflowOutputs();
      expect(result.outputs).toHaveLength(2);
      expect(result.outputs).toEqual([
        {
          name: "output1",
          uuid: "7f08baab-5426-427e-9640-85815d809261",
        },
        {
          name: "output2",
          uuid: "b58fce9c-e507-4714-abfc-739607e02eed",
        },
      ]);
    });
  });
});
