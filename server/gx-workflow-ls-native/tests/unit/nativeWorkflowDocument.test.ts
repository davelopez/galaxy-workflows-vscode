import { WorkflowInput } from "@gxwf/server-common/src/languageTypes";
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
    it.each<[string, WorkflowInput[]]>([
      ["", []],
      [TestWorkflowProvider.workflows.validation.withoutSteps, []],
      [
        TestWorkflowProvider.workflows.validation.withOneStep,
        [{ doc: "Step description", name: "Test Step", type: "data" }],
      ],
      [
        TestWorkflowProvider.workflows.validation.withThreeSteps,
        [
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
        ],
      ],
      [
        TestWorkflowProvider.workflows.validation.withWorkflowOutputLabels,
        [{ doc: "Step description", name: "Test Step", type: "data" }],
      ],
      [
        TestWorkflowProvider.workflows.validation.withoutWorkflowOutputLabels,
        [{ doc: "Step description", name: "Test Step", type: "data" }],
      ],
      [
        TestWorkflowProvider.workflows.validation.withOnlyInputs,
        [
          { default: undefined, doc: "", name: "Dataset Input", type: "data" },
          { default: undefined, doc: "", name: "Collection Input", type: "collection" },
          { default: undefined, doc: "", name: "Text Param", type: "text" },
          { default: 10, doc: "", name: "Integer Param", type: "integer" },
          { default: undefined, doc: "", name: "Float Param", type: "float" },
          { default: undefined, doc: "", name: "Boolean Param", type: "boolean" },
          { default: undefined, doc: "", name: "Color Param", type: "color" },
        ],
      ],
    ])("returns the expected inputs", (wfContent: string, expectedInputs: WorkflowInput[]) => {
      const document = createNativeWorkflowDocument(wfContent);
      const result = document.getWorkflowInputs();
      expect(result.inputs).toHaveLength(expectedInputs.length);
      expect(result.inputs).toEqual(expectedInputs);
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
