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
        description: "",
        type: "data",
      },
      {
        name: "input_2",
        description: "This is the input 2",
        type: "File",
      },
      {
        name: "the_collection",
        description: "This is a collection",
        type: "collection",
      },
      {
        name: "input_int",
        description: "",
        type: "integer",
      },
      {
        name: "text_param",
        description: "",
        type: "text",
      },
    ]);
  });
});
