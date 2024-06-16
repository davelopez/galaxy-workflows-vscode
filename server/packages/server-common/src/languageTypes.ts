import "reflect-metadata";
import {
  CodeAction,
  CodeActionContext,
  CodeActionKind,
  Color,
  ColorInformation,
  ColorPresentation,
  Command,
  CompletionItem,
  CompletionItemKind,
  CompletionItemTag,
  CompletionList,
  DefinitionLink,
  Diagnostic,
  DiagnosticSeverity,
  DocumentHighlight,
  DocumentHighlightKind,
  DocumentLink,
  DocumentSymbol,
  DocumentUri,
  FoldingRange,
  FoldingRangeKind,
  Hover,
  InsertTextFormat,
  FormattingOptions as LSPFormattingOptions,
  Location,
  MarkedString,
  MarkupContent,
  MarkupKind,
  Position,
  Range,
  SelectionRange,
  SymbolInformation,
  SymbolKind,
  TextDocumentEdit,
  TextEdit,
  VersionedTextDocumentIdentifier,
  WorkspaceEdit,
} from "vscode-languageserver-types";

import { TextDocument } from "vscode-languageserver-textdocument";

import { injectable, unmanaged } from "inversify";
import {
  Connection,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  DocumentSymbolParams,
  HoverParams,
} from "vscode-languageserver/browser";
import { URI } from "vscode-uri";
import {
  CleanWorkflowContentsParams,
  CleanWorkflowContentsResult,
  CleanWorkflowDocumentParams,
  CleanWorkflowDocumentResult,
  GetWorkflowInputsResult,
  GetWorkflowOutputsResult,
  LSRequestIdentifiers,
  TargetWorkflowDocumentParams,
  WorkflowDataType,
  WorkflowInput,
  WorkflowOutput,
} from "../../../../shared/src/requestsDefinitions";
import { ASTNodeManager } from "./ast/nodeManager";
import { ConfigService } from "./configService";
import { WorkflowDocument } from "./models/workflowDocument";
import { WorkflowTestsDocument } from "./models/workflowTestsDocument";
import { NoOpValidationProfile } from "./providers/validation/profiles";

export {
  CleanWorkflowContentsParams,
  CleanWorkflowContentsResult,
  CleanWorkflowDocumentParams,
  CleanWorkflowDocumentResult,
  CodeAction,
  CodeActionContext,
  CodeActionKind,
  Color,
  ColorInformation,
  ColorPresentation,
  Command,
  CompletionItem,
  CompletionItemKind,
  CompletionItemTag,
  CompletionList,
  DefinitionLink,
  Diagnostic,
  DiagnosticSeverity,
  DocumentFormattingParams,
  DocumentHighlight,
  DocumentHighlightKind,
  DocumentLink,
  DocumentRangeFormattingParams,
  DocumentSymbol,
  DocumentSymbolParams,
  DocumentUri,
  FoldingRange,
  FoldingRangeKind,
  GetWorkflowInputsResult,
  GetWorkflowOutputsResult,
  Hover,
  HoverParams,
  InsertTextFormat,
  LSRequestIdentifiers,
  Location,
  MarkedString,
  MarkupContent,
  MarkupKind,
  Position,
  Range,
  SelectionRange,
  SymbolInformation,
  SymbolKind,
  TargetWorkflowDocumentParams,
  TextDocument,
  TextDocumentEdit,
  TextEdit,
  VersionedTextDocumentIdentifier,
  WorkflowDataType,
  WorkflowDocument,
  WorkflowInput,
  WorkflowOutput,
  WorkflowTestsDocument,
  WorkspaceEdit,
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

export type ValidationProfileIdentifier = "basic" | "iwc";

/**
 *  Interface representing a validation profile which contains a set of custom rules.
 */
export interface ValidationProfile {
  /** The set of rules defining this validation profile. */
  get rules(): Set<ValidationRule>;

  /** The human-readable name of the profile. */
  name: string;
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

export interface SymbolsProvider {
  getSymbols(documentContext: DocumentContext): DocumentSymbol[];
}

export interface LanguageService<T extends DocumentContext> {
  readonly languageId: string;

  parseDocument(document: TextDocument): T;
  format(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[];
  doHover(documentContext: T, position: Position): Promise<Hover | null>;
  doComplete(documentContext: T, position: Position): Promise<CompletionList | null>;
  getSymbols(documentContext: T): DocumentSymbol[];

  /**
   * Validates the document and reports all the diagnostics found.
   * An optional validation profile can be used to provide additional custom diagnostics.
   */
  validate(documentContext: T, useProfile?: ValidationProfileIdentifier): Promise<Diagnostic[]>;
  getValidationProfile(profileId: ValidationProfileIdentifier): ValidationProfile;

  setServer(server: GalaxyWorkflowLanguageServer): void;
}

/**
 * Abstract service defining the base functionality that a workflow language must
 * implement to provide assistance for workflow documents editing.
 */
@injectable()
export abstract class LanguageServiceBase<T extends DocumentContext> implements LanguageService<T> {
  protected server?: GalaxyWorkflowLanguageServer;
  protected validationProfiles = new Map<ValidationProfileIdentifier, ValidationProfile>();

  constructor(@unmanaged() public readonly languageId: string) {
    this.initializeValidationProfiles();
  }

  public abstract parseDocument(document: TextDocument): T;
  public abstract format(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[];
  public abstract doHover(documentContext: T, position: Position): Promise<Hover | null>;
  public abstract doComplete(documentContext: T, position: Position): Promise<CompletionList | null>;
  public abstract getSymbols(documentContext: T): DocumentSymbol[];

  /** Performs basic syntax and semantic validation based on the document schema. */
  protected abstract doValidation(documentContext: T): Promise<Diagnostic[]>;

  /**
   * Initializes the validation profiles for this language service.
   * Subclasses should override this method to provide custom validation profiles.
   * The default implementation does nothing.
   */
  protected initializeValidationProfiles(): void {
    const defaultProfile = new NoOpValidationProfile();
    this.validationProfiles.set("basic", defaultProfile);
    this.validationProfiles.set("iwc", defaultProfile);
  }

  /**
   * Validates the document and reports all the diagnostics found.
   * An optional validation profile can be used to provide additional custom diagnostics.
   */
  public async validate(documentContext: T, useProfile?: ValidationProfileIdentifier): Promise<Diagnostic[]> {
    const diagnostics = await this.doValidation(documentContext);
    if (useProfile) {
      const profile = this.getValidationProfile(useProfile);
      for (const rule of profile.rules) {
        const contributedDiagnostics = await rule.validate(documentContext);
        contributedDiagnostics.forEach((diagnostic) => {
          diagnostic.source = profile.name;
        });
        diagnostics.push(...contributedDiagnostics);
      }
    }
    return diagnostics;
  }

  public getValidationProfile(profileId: ValidationProfileIdentifier): ValidationProfile {
    const profile = this.validationProfiles.get(profileId);
    if (!profile) {
      throw new Error(`Validation profile not found for id: ${profileId}`);
    }
    return profile;
  }

  public setServer(server: GalaxyWorkflowLanguageServer): void {
    this.server = server;
  }
}

export interface WorkflowLanguageService extends LanguageService<WorkflowDocument> {}
export interface WorkflowTestsLanguageService extends LanguageService<WorkflowTestsDocument> {}

export interface GalaxyWorkflowLanguageServer {
  connection: Connection;
  documentsCache: DocumentsCache;
  configService: ConfigService;
  workflowDataProvider: WorkflowDataProvider;
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

export interface WorkflowDataProvider {
  getWorkflowInputs(workflowDocumentUri: string): Promise<GetWorkflowInputsResult>;
  getWorkflowOutputs(workflowDocumentUri: string): Promise<GetWorkflowOutputsResult>;
}

const TYPES = {
  DocumentsCache: Symbol.for("DocumentsCache"),
  ConfigService: Symbol.for("ConfigService"),
  Connection: Symbol.for("Connection"),
  WorkflowLanguageService: Symbol.for("WorkflowLanguageService"),
  WorkflowTestsLanguageService: Symbol.for("WorkflowTestsLanguageService"),
  GalaxyWorkflowLanguageServer: Symbol.for("GalaxyWorkflowLanguageServer"),
  WorkflowDataProvider: Symbol.for("WorkflowDataProvider"),
  SymbolsProvider: Symbol.for("SymbolsProvider"),
};

export { TYPES };
