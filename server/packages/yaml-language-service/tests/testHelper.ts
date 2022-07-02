import { TextDocument } from "vscode-languageserver-textdocument";
import { PropertyASTNode } from "../src/parser/astTypes";

export function toTextDocument(contents: string): TextDocument {
  const textDoc = TextDocument.create("foo://bar/file.yaml", "yaml", 0, contents);

  return textDoc;
}

export function expectPropertyToHaveKeyValue(property: PropertyASTNode, key: string, value: string): void {
  expect(property.keyNode.value).toBe(key);
  expect(property.valueNode).toBeDefined();
  expect(property.valueNode?.value).toBe(value);
}
