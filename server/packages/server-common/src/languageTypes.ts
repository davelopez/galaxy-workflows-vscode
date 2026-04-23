import "reflect-metadata";
import type {
  ToolStateDiagnostic,
  WorkflowInput,
  WorkflowOutput,
  WorkflowDataType,
  ParsedTool,
} from "@galaxy-tool-util/schema";
import type { CacheStorage } from "@galaxy-tool-util/core";
export type { ToolStateDiagnostic, CacheStorage, ParsedTool, WorkflowInput, WorkflowOutput, WorkflowDataType };
/** Builds a CacheStorage. Browser returns IndexedDBCacheStorage; node returns FilesystemCacheStorage(getCacheDir(cacheDir)). */
export type CacheStorageFactory = (cacheDir?: string) => CacheStorage;
import {
  CodeAction,
  CodeActionContext,
  CodeActionKind,
  CodeLens,
  Color,
  ColorInformation,
  ColorPresentation,
  Command,
  CompletionItem,
  CompletionItemKind,
  CompletionItemTag,
  CompletionList,
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
import type { DefinitionLink } from "vscode-languageserver-types";

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
import { LSNotificationIdentifiers, LSRequestIdentifiers } from "../../../../shared/src/requestsDefinitions";
import type {
  CleanWorkflowContentsParams,
  CleanWorkflowContentsResult,
  CleanWorkflowDocumentParams,
  CleanWorkflowDocumentResult,
  ConvertWorkflowContentsParams,
  ConvertWorkflowContentsResult,
  GetToolCacheStatusResult,
  GetWorkflowInputsResult,
  GetWorkflowOutputsResult,
  GetWorkflowToolIdsResult,
  GetWorkflowToolsParams,
  GetWorkflowToolsResult,
  PopulateToolCacheForToolParams,
  PopulateToolCacheParams,
  PopulateToolCacheResult,
  TargetWorkflowDocumentParams,
  ToolRef,
  WorkflowToolEntry,
  SearchToolsParams,
  SearchToolsResult,
  ToolSearchHit,
  GetStepSkeletonParams,
  GetStepSkeletonResult,
} from "../../../../shared/src/requestsDefinitions";
import { ASTNodeManager } from "./ast/nodeManager";
import type { ConfigService } from "./configService";
import { WorkflowDocument } from "./models/workflowDocument";
import { WorkflowTestsDocument } from "./models/workflowTestsDocument";
import { NoOpValidationProfile } from "./providers/validation/profiles";

export {
  CodeAction,
  CodeActionContext,
  CodeActionKind,
  CodeLens,
  Color,
  ColorInformation,
  ColorPresentation,
  Command,
  CompletionItem,
  CompletionItemKind,
  CompletionItemTag,
  CompletionList,
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
  Hover,
  HoverParams,
  InsertTextFormat,
  LSNotificationIdentifiers,
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
  TextDocument,
  TextDocumentEdit,
  TextEdit,
  VersionedTextDocumentIdentifier,
  WorkflowDocument,
  WorkflowTestsDocument,
  WorkspaceEdit,
};

export type {
  DefinitionLink,
  CleanWorkflowContentsParams,
  CleanWorkflowContentsResult,
  CleanWorkflowDocumentParams,
  CleanWorkflowDocumentResult,
  ConvertWorkflowContentsParams,
  ConvertWorkflowContentsResult,
  GetToolCacheStatusResult,
  GetWorkflowInputsResult,
  GetWorkflowOutputsResult,
  GetWorkflowToolIdsResult,
  GetWorkflowToolsParams,
  GetWorkflowToolsResult,
  PopulateToolCacheForToolParams,
  PopulateToolCacheParams,
  PopulateToolCacheResult,
  TargetWorkflowDocumentParams,
  ToolRef,
  WorkflowToolEntry,
  SearchToolsParams,
  SearchToolsResult,
  ToolSearchHit,
  GetStepSkeletonParams,
  GetStepSkeletonResult,
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
  doCodeLens(documentContext: T): Promise<CodeLens[]>;
  getSymbols(documentContext: T): DocumentSymbol[];

  /**
   * Validates the document and reports all the diagnostics found.
   * An optional validation profile can be used to provide additional custom diagnostics.
   */
  validate(documentContext: T, useProfile?: ValidationProfileIdentifier): Promise<Diagnostic[]>;
  getValidationProfile(profileId: ValidationProfileIdentifier): ValidationProfile;

  setServer(server: GalaxyWorkflowLanguageServer): void;

  /**
   * Returns the cleaned text for the given workflow document text.
   * Delegates to the galaxy-tool-util cleanWorkflow() implementation.
   */
  cleanWorkflowText(text: string): Promise<string>;

  /**
   * Converts workflow text to the target format.
   * Format2 service converts to native; native service converts to format2.
   * Throws if the targetFormat is not supported by this language service.
   */
  convertWorkflowText(text: string, targetFormat: "format2" | "native"): Promise<string>;
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
  public async doCodeLens(_documentContext: T): Promise<CodeLens[]> {
    return [];
  }
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
          diagnostic.source = diagnostic.source ?? profile.name;
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

  public async cleanWorkflowText(text: string): Promise<string> {
    return text;
  }

  public async convertWorkflowText(_text: string, targetFormat: "format2" | "native"): Promise<string> {
    throw new Error(`Conversion to ${targetFormat} is not supported by this language service.`);
  }
}

export interface WorkflowLanguageService extends LanguageService<WorkflowDocument> {}
export interface WorkflowTestsLanguageService extends LanguageService<WorkflowTestsDocument> {}

export interface GalaxyWorkflowLanguageServer {
  connection: Connection;
  documentsCache: DocumentsCache;
  configService: ConfigService;
  workflowDataProvider: WorkflowDataProvider;
  toolRegistryService: ToolRegistryService;
  autoResolutionEnabled: boolean;
  start(): void;
  getLanguageServiceById(languageId: string): LanguageService<DocumentContext>;
  revalidateDocument(uri: string): void;
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

export interface ToolRegistryService {
  hasCached(toolId: string, toolVersion?: string): Promise<boolean>;
  listCached(): Promise<Array<{
    cache_key: string;
    tool_id: string;
    tool_version: string;
    source: string;
    source_url: string;
    cached_at: string;
  }>>;
  populateCache(tools: Array<{ toolId: string; toolVersion?: string }>): Promise<PopulateToolCacheResult>;
  configure(settings: { toolShedUrl: string; storage: CacheStorage }): void;
  /** Returns cached tool inputs (parameter list) without hitting the network. Returns null if not cached. */
  getToolParameters(toolId: string, toolVersion?: string): Promise<unknown[] | null>;
  /** Returns full ParsedTool metadata from cache. Returns null if not cached. No network. */
  getToolInfo(toolId: string, toolVersion?: string): Promise<ParsedTool | null>;
  /** Returns the ToolShed base URL the registry was configured with, or undefined before configure(). */
  getToolShedBaseUrl(): string | undefined;
  getCacheSize(): Promise<number>;
  /** Returns true if a previous auto-resolution attempt for this tool failed. */
  hasResolutionFailed(toolId: string, toolVersion?: string): boolean;
  /** Records that auto-resolution failed for this tool. */
  markResolutionFailed(toolId: string, toolVersion?: string): void;
  /** Clears any prior resolution-failed flag for this tool (e.g. after a successful retry). */
  clearResolutionFailed(toolId: string, toolVersion?: string): void;
  /** Validate native step tool_state against cached tool schema. */
  validateNativeStep(
    toolId: string,
    toolVersion: string | undefined,
    toolState: Record<string, unknown>,
    inputConnections?: Record<string, unknown>
  ): Promise<ToolStateDiagnostic[]>;
  /**
   * Returns the currently configured search service (rebuilt on each configure()).
   * Undefined before configure() has been called.
   */
  getSearchService(): import("@galaxy-tool-util/search").ToolSearchService | undefined;
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
  ToolRegistryService: Symbol.for("ToolRegistryService"),
  /** Factory producing a CacheStorage. Browser entry binds an IndexedDB factory; node entry binds a FilesystemCacheStorage factory. */
  CacheStorageFactory: Symbol.for("CacheStorageFactory"),
};

export { TYPES };
