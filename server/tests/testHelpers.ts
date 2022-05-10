import { ASTNode, getLanguageService, JSONDocument, JSONPath } from "vscode-json-languageservice";
import { TextDocument } from "../src/languageTypes";
import * as Json from "jsonc-parser";

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

export function getNodeValue(node: ASTNode): unknown {
  return Json.getNodeValue(node);
}

export function getNodePath(node: ASTNode): JSONPath {
  return Json.getNodePath(node);
}
