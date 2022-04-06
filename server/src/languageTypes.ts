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
  DocumentSymbolParams,
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
  DocumentSymbolParams,
};

export interface FormattingOptions extends LSPFormattingOptions {
  insertFinalNewline?: boolean;
}

export interface HoverContentContributor {
  /**
   * Gets the contents that will be contributed to a new section of the Hover message
   * @param workflowDocument The workflow document
   * @param position The hover position
   */
  onHoverContent(workflowDocument: WorkflowDocument, position: Position): string;
}

export interface WorkflowLanguageService {
  format(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[];
  parseWorkflowDocument(document: TextDocument): WorkflowDocument;
  doValidation(workflowDocument: WorkflowDocument): Promise<Diagnostic[]>;
  doHover(workflowDocument: WorkflowDocument, position: Position): Promise<Hover | null>;
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
