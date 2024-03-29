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
import { WorkflowDocuments } from "./models/workflowDocuments";
import { GalaxyWorkflowLanguageServer } from "./server";

export {
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

/**
 * Interface for contributing additional diagnostics to the validation process.
 */
export interface ValidationRule {
  /**
   * Validates the given workflow document and provides diagnostics according
   * to this rule.
   * @param workflowDocument The workflow document
   */
  validate(workflowDocument: WorkflowDocument): Promise<Diagnostic[]>;
}

/**
 *  Interface representing a validation profile which contains a set of custom rules.
 */
export interface ValidationProfile {
  /** The unique identifier of this validation profile. */
  get id(): string;

  /** The set of rules defining this validation profile. */
  get rules(): Set<ValidationRule>;
}

/**
 * Interface for validating workflows and collecting diagnostics.
 */
export interface WorkflowValidator {
  /** Collects diagnostics for the given workflow document. */
  doValidation(workflowDocument: WorkflowDocument): Promise<Diagnostic[]>;
}

/**
 * Abstract service defining the base functionality that a workflow language must
 * implement to provide assistance for workflow documents editing.
 */
export abstract class WorkflowLanguageService {
  public abstract format(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[];
  public abstract parseWorkflowDocument(document: TextDocument): WorkflowDocument;
  public abstract doHover(workflowDocument: WorkflowDocument, position: Position): Promise<Hover | null>;
  public abstract doComplete(workflowDocument: WorkflowDocument, position: Position): Promise<CompletionList | null>;

  /** Performs basic syntax and semantic validation based on the workflow schema. */
  protected abstract doValidation(workflowDocument: WorkflowDocument): Promise<Diagnostic[]>;

  /**
   * Validates the document and reports all the diagnostics found.
   * An optional validation profile can be used to provide additional custom diagnostics.
   */
  public async validate(
    workflowDocument: WorkflowDocument,
    useProfile: ValidationProfile | null = null
  ): Promise<Diagnostic[]> {
    const diagnostics = await this.doValidation(workflowDocument);
    if (useProfile) {
      useProfile.rules.forEach(async (validationRule) => {
        const contributedDiagnostics = await validationRule.validate(workflowDocument);
        diagnostics.push(...contributedDiagnostics);
      });
    }
    return diagnostics;
  }
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
