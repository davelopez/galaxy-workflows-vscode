"use strict";

import { TextDocument } from "vscode-languageserver-textdocument";
import { Composer, Document, DocumentOptions, LineCounter, ParseOptions, Parser, SchemaOptions } from "yaml";
import { TextBuffer } from "../utils/textBuffer";
import { YAMLDocument, YAMLSubDocument } from "./yamlDocument";

export { YAMLDocument };

export type YamlVersion = "1.1" | "1.2";
export interface ParserOptions {
  yamlVersion: YamlVersion;
}
export const defaultOptions: ParserOptions = {
  yamlVersion: "1.2",
};

export function parse(textDocument: TextDocument, parserOptions: ParserOptions = defaultOptions): YAMLDocument {
  const text = textDocument.getText();
  const options: ParseOptions & DocumentOptions & SchemaOptions = {
    strict: false,
    version: parserOptions.yamlVersion ?? defaultOptions.yamlVersion,
    keepSourceTokens: true,
  };
  const composer = new Composer(options);
  const lineCounter = new LineCounter();
  let isLastLineEmpty = false;
  if (textDocument) {
    const textBuffer = new TextBuffer(textDocument);
    const position = textBuffer.getPosition(text.length);
    const lineContent = textBuffer.getLineContent(position.line);
    isLastLineEmpty = lineContent.trim().length === 0;
  }
  const parser = isLastLineEmpty ? new Parser() : new Parser(lineCounter.addNewLine);
  const tokens = parser.parse(text);
  const tokensArr = Array.from(tokens);
  const docs = composer.compose(tokensArr, true, text.length);
  const parsedDocs: YAMLSubDocument[] = Array.from(docs, (doc) => getParsedSubDocument(doc, lineCounter));

  return new YAMLDocument(parsedDocs, textDocument);
}

function getParsedSubDocument(parsedDocument: Document, lineCounter: LineCounter): YAMLSubDocument {
  return new YAMLSubDocument(parsedDocument, lineCounter);
}
