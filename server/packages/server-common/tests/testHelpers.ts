import { ASTNode, PropertyASTNode } from "../src/ast/types";
import { WorkflowDataProvider, WorkflowInput, WorkflowOutput } from "../src/languageTypes";

export function expectPropertyNodeToHaveKey(propertyNode: ASTNode | null, expectedPropertyKey: string): void {
  expect(propertyNode?.type).toBe("property");
  expect((propertyNode as PropertyASTNode).keyNode.value).toBe(expectedPropertyKey);
}

/**
 * Simulates the position of the cursor in the contents of a text document.
 * @param template Represents the contents of a text document with a single character to be replaced.
 * @param char Defaults to "$". The character to be replaced in the template. Its position will be used to simulate the position of the cursor.
 * @returns The contents of the template string with the character removed and the position of the character.
 */
export function parseTemplate(
  template: string,
  char?: string
): { contents: string; position: { line: number; character: number } } {
  if (!char) {
    char = "$";
  }
  let position = { line: 0, character: 0 };
  const contents = template.replace(char, "");

  const lines = template.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const character = lines[i].indexOf(char);
    if (character !== -1) {
      position = { line: i, character };
      return { contents, position };
    }
  }

  return { contents, position };
}

export const FAKE_DATASET_INPUT: WorkflowInput = {
  name: "My fake dataset",
  doc: "This is a simple dataset",
  type: "data",
};

export const EXPECTED_WORKFLOW_INPUTS: WorkflowInput[] = [
  FAKE_DATASET_INPUT,
  {
    name: "Input dataset: fake",
    doc: "This is a simple dataset with a colon in the name",
    type: "File",
  },
  {
    name: "My fake collection",
    doc: "This is a collection",
    type: "collection",
  },
];

export const EXPECTED_WORKFLOW_OUTPUTS: WorkflowOutput[] = [
  {
    name: "My output",
    uuid: "1234-5678-91011-1213",
  },
  {
    name: "My second output",
    uuid: "1234-5678-91011-1214",
  },
  {
    name: "My third output: with colon",
    uuid: "1234-5678-91011-1215",
  },
];

/**
 * A fake implementation of the WorkflowDataProvider interface.
 * Simulates a workflow with the expected inputs and outputs.
 */
export const FAKE_WORKFLOW_DATA_PROVIDER: WorkflowDataProvider = {
  async getWorkflowInputs(_workflowDocumentUri: string) {
    return {
      inputs: EXPECTED_WORKFLOW_INPUTS,
    };
  },
  async getWorkflowOutputs(_workflowDocumentUri: string) {
    return {
      outputs: EXPECTED_WORKFLOW_OUTPUTS,
    };
  },
};
