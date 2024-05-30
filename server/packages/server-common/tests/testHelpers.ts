import { ASTNode, PropertyASTNode } from "../src/ast/types";

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
