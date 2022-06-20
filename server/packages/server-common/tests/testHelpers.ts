import { ASTNode, PropertyASTNode } from "../src/ast/types";

export function expectPropertyNodeToHaveKey(propertyNode: ASTNode | null, expectedPropertyKey: string): void {
  expect(propertyNode?.type).toBe("property");
  expect((propertyNode as PropertyASTNode).keyNode.value).toBe(expectedPropertyKey);
}
