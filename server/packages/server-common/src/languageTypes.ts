import "reflect-metadata";
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
import { ASTNodeManager } from "./ast/nodeManager";
import { URI } from "vscode-uri";
import { WorkflowTestsDocument } from "./models/workflowTestsDocument";
import { injectable, unmanaged } from "inversify";
import { ConfigService } from "./configService";

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
  WorkflowTestsDocument,
};

export interface FormattingOptions extends LSPFormattingOptions {
  insertFinalNewline?: boolean;
}

export interface HoverContentContributor {
  /**
   * Gets the contents that will be contributed to a new section of the Hover message
   * @param documentContext The document context
   * @param position The hover position
   */
  onHoverContent(documentContext: DocumentContext, position: Position): string;
}

/**
 * Interface for contributing additional diagnostics to the validation process.
 */
export interface ValidationRule {
  /**
   * Validates the given workflow document and provides diagnostics according
   * to this rule.
   * @param documentContext The workflow document
   */
  validate(documentContext: DocumentContext): Promise<Diagnostic[]>;
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
 * Provides information about a processed text document.
 */
export interface DocumentContext {
  languageId: string;
  uri: URI;
  textDocument: TextDocument;
  nodeManager: ASTNodeManager;
  internalDocument: unknown;
}

export interface LanguageService<T extends DocumentContext> {
  readonly languageId: string;

  parseDocument(document: TextDocument): T;
  format(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[];
  doHover(documentContext: T, position: Position): Promise<Hover | null>;
  doComplete(documentContext: T, position: Position): Promise<CompletionList | null>;

  /**
   * Validates the document and reports all the diagnostics found.
   * An optional validation profile can be used to provide additional custom diagnostics.
   */
  validate(documentContext: T, useProfile?: ValidationProfile): Promise<Diagnostic[]>;
}

/**
 * Abstract service defining the base functionality that a workflow language must
 * implement to provide assistance for workflow documents editing.
 */
@injectable()
export abstract class LanguageServiceBase<T extends DocumentContext> implements LanguageService<T> {
  constructor(@unmanaged() public readonly languageId: string) {}

  public abstract parseDocument(document: TextDocument): T;
  public abstract format(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[];
  public abstract doHover(documentContext: T, position: Position): Promise<Hover | null>;
  public abstract doComplete(documentContext: T, position: Position): Promise<CompletionList | null>;

  /** Performs basic syntax and semantic validation based on the document schema. */
  protected abstract doValidation(documentContext: T): Promise<Diagnostic[]>;

  /**
   * Validates the document and reports all the diagnostics found.
   * An optional validation profile can be used to provide additional custom diagnostics.
   */
  public async validate(documentContext: T, useProfile?: ValidationProfile): Promise<Diagnostic[]> {
    const diagnostics = await this.doValidation(documentContext);
    if (useProfile) {
      useProfile.rules.forEach(async (validationRule) => {
        const contributedDiagnostics = await validationRule.validate(documentContext);
        diagnostics.push(...contributedDiagnostics);
      });
    }
    return diagnostics;
  }
}

export interface WorkflowLanguageService extends LanguageService<WorkflowDocument> {}
export interface WorkflowTestsLanguageService extends LanguageService<WorkflowTestsDocument> {}

export interface GalaxyWorkflowLanguageServer {
  connection: Connection;
  documentsCache: DocumentsCache;
  configService: ConfigService;
  start(): void;
  getLanguageServiceById(languageId: string): LanguageService<DocumentContext>;
}

export interface DocumentsCache {
  get(documentUri: string): DocumentContext | undefined;
  all(): DocumentContext[];
  addOrReplaceDocument(documentContext: DocumentContext): void;
  removeDocument(documentUri: string): void;
  dispose(): void;

  get schemesToSkip(): string[];
}

const TYPES = {
  DocumentsCache: Symbol.for("DocumentsCache"),
  ConfigService: Symbol.for("ConfigService"),
  Connection: Symbol.for("Connection"),
  WorkflowLanguageService: Symbol.for("WorkflowLanguageService"),
  WorkflowTestsLanguageService: Symbol.for("WorkflowTestsLanguageService"),
  GalaxyWorkflowLanguageServer: Symbol.for("GalaxyWorkflowLanguageServer"),
};

export { TYPES };
