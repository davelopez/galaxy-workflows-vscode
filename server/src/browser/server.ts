import { createConnection, BrowserMessageReader, BrowserMessageWriter } from "vscode-languageserver/browser";

import { InitializeParams, InitializeResult, ServerCapabilities, TextDocuments } from "vscode-languageserver/browser";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as formatProvider from "../providers/formatProvider";

console.log("running server galaxy-workflow-language-server-native");

/* browser specific setup code */

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

/* from here on, all code is non-browser specific and could be shared with a regular extension */

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const capabilities: ServerCapabilities = {
    documentFormattingProvider: true,
  };
  return { capabilities };
});

// Track open, change and close text document events
const documents = new TextDocuments(TextDocument);
documents.listen(connection);

// Register providers
connection.onDocumentFormatting((params) => {
  const document = documents.get(params.textDocument.uri);
  if (document === undefined) {
    return undefined;
  }
  return formatProvider.onDocumentFormatting(document, params);
});

connection.onDocumentRangeFormatting((params) => {
  const document = documents.get(params.textDocument.uri);
  if (document === undefined) {
    return undefined;
  }
  return formatProvider.onDocumentRangeFormatting(document, params);
});

// Listen on the connection
connection.listen();
