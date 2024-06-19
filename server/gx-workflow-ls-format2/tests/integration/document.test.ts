import { createFormat2WorkflowDocument } from "../testHelpers";

describe("GxFormat2WorkflowDocument", () => {
  it("should get workflow inputs", () => {
    const TEST_WORKFLOW_CONTENT = `
class: GalaxyWorkflow
inputs:
  input_1: data
  input_2:
    type: File
    doc: This is the input 2
    optional: false
  the_collection:
    type: collection
    doc: This is a collection
  input_int: integer
  text_param:
    optional: true
    default: text value
    restrictOnConnections: true
    type: text
    `;
    const document = createFormat2WorkflowDocument(TEST_WORKFLOW_CONTENT);

    const result = document.getWorkflowInputs();

    expect(result.inputs.length).toBe(5);
    expect(result.inputs).toEqual([
      {
        name: "input_1",
        doc: "",
        type: "data",
      },
      {
        name: "input_2",
        doc: "This is the input 2",
        type: "File",
        optional: false,
      },
      {
        name: "the_collection",
        doc: "This is a collection",
        type: "collection",
      },
      {
        name: "input_int",
        doc: "",
        type: "integer",
      },
      {
        name: "text_param",
        doc: "",
        type: "text",
        default: "text value",
        optional: true,
      },
    ]);
  });

  it("should get workflow outputs", () => {
    const TEST_WORKFLOW_CONTENT = `
class: GalaxyWorkflow
outputs:
  output_1:
    outputSource: second_cat/out_file1
  output_2:
    outputSource: first_cat/out_file2
    doc: This is the output 2
    `;
    const document = createFormat2WorkflowDocument(TEST_WORKFLOW_CONTENT);

    const result = document.getWorkflowOutputs();

    expect(result.outputs.length).toBe(2);
    expect(result.outputs).toEqual([
      {
        name: "output_1",
        doc: "",
      },
      {
        name: "output_2",
        doc: "This is the output 2",
      },
    ]);
  });
});
