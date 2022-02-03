import {
  Range,
  Position,
  DocumentUri,
  MarkupContent,
  MarkupKind,
  Color,
  ColorInformation,
  ColorPresentation,
  FoldingRange,
  FoldingRangeKind,
  SelectionRange,
  Diagnostic,
  DiagnosticSeverity,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  CompletionItemTag,
  InsertTextFormat,
  SymbolInformation,
  SymbolKind,
  DocumentSymbol,
  Location,
  Hover,
  MarkedString,
  FormattingOptions as LSPFormattingOptions,
  DefinitionLink,
  CodeActionContext,
  Command,
  CodeAction,
  DocumentHighlight,
  DocumentLink,
  WorkspaceEdit,
  TextEdit,
  CodeActionKind,
  TextDocumentEdit,
  VersionedTextDocumentIdentifier,
  DocumentHighlightKind,
} from "vscode-languageserver-types";

import { TextDocument } from "vscode-languageserver-textdocument";

import {
  Connection,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  HoverParams,
} from "vscode-languageserver/browser";
import { WorkflowDocument } from "./models/workflowDocument";
import {
  ASTNode,
  ArrayASTNode,
  ObjectASTNode,
  PropertyASTNode,
  StringASTNode,
  BooleanASTNode,
  NumberASTNode,
  NullASTNode,
} from "vscode-json-languageservice";
import { WorkflowDocuments } from "./models/workflowDocuments";
import { GalaxyWorkflowLanguageServer } from "./server";

export {
  ASTNode,
  ArrayASTNode,
  ObjectASTNode,
  PropertyASTNode,
  StringASTNode,
  BooleanASTNode,
  NumberASTNode,
  NullASTNode,
  TextDocument,
  Range,
  Position,
  DocumentUri,
  MarkupContent,
  MarkupKind,
  Color,
  ColorInformation,
  ColorPresentation,
  FoldingRange,
  FoldingRangeKind,
  SelectionRange,
  Diagnostic,
  DiagnosticSeverity,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  CompletionItemTag,
  InsertTextFormat,
  DefinitionLink,
  SymbolInformation,
  SymbolKind,
  DocumentSymbol,
  Location,
  Hover,
  HoverParams,
  MarkedString,
  CodeActionContext,
  Command,
  CodeAction,
  DocumentHighlight,
  DocumentLink,
  WorkspaceEdit,
  TextEdit,
  CodeActionKind,
  TextDocumentEdit,
  VersionedTextDocumentIdentifier,
  DocumentHighlightKind,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  WorkflowDocument,
};

export interface FormattingOptions extends LSPFormattingOptions {
  insertFinalNewline?: boolean;
}

export interface WorkflowLanguageService {
  format(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[];
  parseWorkflowDocument(document: TextDocument): WorkflowDocument;
}

export abstract class ServerContext {
  protected connection: Connection;
  protected workflowDocuments: WorkflowDocuments;
  protected languageService: WorkflowLanguageService;
  protected server: GalaxyWorkflowLanguageServer;

  constructor(server: GalaxyWorkflowLanguageServer) {
    this.server = server;
    this.workflowDocuments = server.workflowDocuments;
    this.languageService = server.languageService;
    this.connection = server.connection;
  }
}
