import { createFormat2WorkflowDocument } from "../testHelpers";

describe("GxFormat2WorkflowDocument", () => {
  it("should get workflow inputs", () => {
    const documentContent = `
class: GalaxyWorkflow
inputs:
  input_1: data
  input_2:
    type: File
    doc: This is the input 2
outputs:
  output_1:
    outputSource: first_cat/out_file1
steps:
  first_cat:
    tool_id: cat
    in:
      input1: input_1
    `;
    const document = createFormat2WorkflowDocument(documentContent);
    const result = document.getWorkflowInputs();
    expect(result.inputs.length).toBe(2);
    expect(result.inputs).toEqual([
      {
        name: "input_1",
        description: "",
        type: "data_input",
      },
      {
        name: "input_2",
        description: "This is the input 2",
        type: "data_input",
      },
    ]);
  });
});
