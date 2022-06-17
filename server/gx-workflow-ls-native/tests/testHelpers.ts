import { ASTNode, getLanguageService, JSONDocument } from "vscode-json-languageservice";
import { TextDocument } from "@gxwf/server-common/src/languageTypes";
import { NativeWorkflowDocument } from "../src/nativeWorkflowDocument";

export function toJsonDocument(contents: string): { textDoc: TextDocument; jsonDoc: JSONDocument } {
  const textDoc = TextDocument.create("foo://bar/file.json", "json", 0, contents);

  const ls = getLanguageService({});
  const jsonDoc = ls.parseJSONDocument(textDoc) as JSONDocument;
  return { textDoc, jsonDoc };
}

export function getJsonDocumentRoot(contents: string): ASTNode {
  const { jsonDoc } = toJsonDocument(contents);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return jsonDoc.root!;
}

export function createNativeWorkflowDocument(contents: string): NativeWorkflowDocument {
  const { textDoc, jsonDoc } = toJsonDocument(contents);
  return new NativeWorkflowDocument(textDoc, jsonDoc);
}
