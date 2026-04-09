import {
  Connection,
  InitializeParams,
  InitializeResult,
  ServerCapabilities,
  TextDocuments,
  WorkspaceFolder,
} from "vscode-languageserver";
import { TYPES, TextDocument } from "./languageTypes";
import type {
  DocumentContext,
  DocumentsCache,
  GalaxyWorkflowLanguageServer,
  LanguageService,
  ToolRegistryService,
  WorkflowDataProvider,
  WorkflowLanguageService,
  WorkflowTestsLanguageService,
} from "./languageTypes";
import { FormattingHandler } from "./providers/formattingHandler";
import { HoverHandler } from "./providers/hover/hoverHandler";
import { SymbolsHandler } from "./providers/symbolsHandler";
import { CleanWorkflowService } from "./services/cleanWorkflow";
import { ConvertWorkflowService } from "./services/convertWorkflow";
import { ToolCacheService } from "./services/toolCacheService";
// import { DebugHoverContentContributor } from "./providers/hover/debugHoverContentContributor";
import { inject, injectable } from "inversify";
import type { ConfigService } from "./configService";
import { CompletionHandler } from "./providers/completionHandler";
import { ServerEventHandler } from "./providers/handler";

@injectable()
export class GalaxyWorkflowLanguageServerImpl implements GalaxyWorkflowLanguageServer {
  public readonly documents = new TextDocuments(TextDocument);
  public autoResolutionEnabled = false;
  protected workspaceFolders: WorkspaceFolder[] | null | undefined;
  private languageServiceMapper: Map<string, LanguageService<DocumentContext>> = new Map();
  private serverEventHandlers: ServerEventHandler[] = [];
  private toolCacheService: ToolCacheService | undefined;

  constructor(
    @inject(TYPES.Connection) public readonly connection: Connection,
    @inject(TYPES.DocumentsCache) public readonly documentsCache: DocumentsCache,
    @inject(TYPES.ConfigService) public readonly configService: ConfigService,
    @inject(TYPES.WorkflowDataProvider) public readonly workflowDataProvider: WorkflowDataProvider,
    @inject(TYPES.WorkflowLanguageService) public readonly workflowLanguageService: WorkflowLanguageService,
    @inject(TYPES.WorkflowTestsLanguageService) workflowTestsLanguageService: WorkflowTestsLanguageService,
    @inject(TYPES.ToolRegistryService) public readonly toolRegistryService: ToolRegistryService
  ) {
    this.languageServiceMapper.set(workflowLanguageService.languageId, workflowLanguageService);
    this.languageServiceMapper.set(workflowTestsLanguageService.languageId, workflowTestsLanguageService);
    workflowLanguageService.setServer(this);
    workflowTestsLanguageService.setServer(this);

    // Track open, change and close text document events
    this.trackDocumentChanges(connection);

    this.connection.onInitialize((params) => this.initialize(params));

    this.registerHandlers();

    this.registerServices();

    this.connection.onShutdown(() => this.cleanup());
  }

  public start(): void {
    this.connection.listen();
  }

  public getLanguageServiceById(languageId: string): LanguageService<DocumentContext> {
    const languageService = this.languageServiceMapper.get(languageId);
    if (!languageService) {
      throw new Error(`Language service not found for languageId: ${languageId}`);
    }
    return languageService;
  }

  private async initialize(params: InitializeParams): Promise<InitializeResult> {
    this.configService.initialize(params.capabilities, () => this.onConfigurationChanged());
    this.workspaceFolders = params.workspaceFolders;
    const initOpts = params.initializationOptions as Record<string, unknown> | undefined;
    this.autoResolutionEnabled = !!initOpts?.toolAutoResolution;

    const settings = await this.configService.getDocumentSettings("");
    this.toolRegistryService.configure({
      cacheDir: settings.toolCache.directory,
      toolShedUrl: settings.toolShed.url,
    });

    const capabilities: ServerCapabilities = {
      documentFormattingProvider: true,
      hoverProvider: true,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['"', ":"],
      },
      documentSymbolProvider: true,
    };

    return {
      capabilities,
    };
  }

  private registerHandlers(): void {
    this.serverEventHandlers.push(new FormattingHandler(this));
    this.serverEventHandlers.push(
      new HoverHandler(this, [
        // new DebugHoverContentContributor(), //TODO remove this contributor before release
      ])
    );
    this.serverEventHandlers.push(new SymbolsHandler(this));
    this.serverEventHandlers.push(new CompletionHandler(this));
  }

  private registerServices(): void {
    CleanWorkflowService.register(this);
    ConvertWorkflowService.register(this);
    this.toolCacheService = ToolCacheService.register(this);
  }

  private trackDocumentChanges(connection: Connection): void {
    this.documents.listen(connection);
    this.documents.onDidChangeContent((event) => this.onDidChangeContent(event.document));
    this.documents.onDidClose((event) => this.onDidClose(event.document));
    // NOTE: onDidOpen fires after onDidChangeContent for the same open event
    // (vscode-languageserver emits onDidChangeContent first, which populates
    // documentsCache; onDidOpen follows in the same tick). Both are registered
    // here in that order so documentsCache.get() is guaranteed to succeed.
    // TODO: also trigger resolution when a new tool_id is added to an already-open
    // document (requires diffing tool ID sets between validation runs).
    this.documents.onDidOpen((event) => {
      const docContext = this.documentsCache.get(event.document.uri);
      if (docContext) {
        this.toolCacheService?.scheduleResolution(docContext);
      }
    });
  }

  /**
   * An event that fires when a workflow document has been opened or the content changes.
   */
  private onDidChangeContent(textDocument: TextDocument): void {
    const languageService = this.getLanguageServiceById(textDocument.languageId);
    const documentContext = languageService.parseDocument(textDocument);
    this.documentsCache.addOrReplaceDocument(documentContext);
    this.validateDocument(documentContext);
  }

  private onDidClose(textDocument: TextDocument): void {
    this.documentsCache.removeDocument(textDocument.uri);
    this.configService.onDocumentClose(textDocument.uri);
    this.clearValidation(textDocument);
  }

  private onConfigurationChanged(): void {
    this.configService.getDocumentSettings("").then((settings) => {
      this.toolRegistryService.configure({
        cacheDir: settings.toolCache.directory,
        toolShedUrl: settings.toolShed.url,
      });
    });
    this.documentsCache.all().forEach((documentContext) => {
      this.validateDocument(documentContext);
    });
  }

  private cleanup(): void {
    this.documentsCache.dispose();
    this.serverEventHandlers.forEach((handler) => handler.dispose());
  }

  private async validateDocument(documentContext: DocumentContext): Promise<void> {
    if (this.documentsCache.schemesToSkip.includes(documentContext.uri.scheme)) {
      return;
    }
    const settings = await this.configService.getDocumentSettings(documentContext.textDocument.uri);
    const languageService = this.getLanguageServiceById(documentContext.languageId);
    languageService.validate(documentContext, settings.validation.profile).then((diagnostics) => {
      this.connection.sendDiagnostics({ uri: documentContext.textDocument.uri, diagnostics });
    });
  }

  private clearValidation(textDocument: TextDocument): void {
    this.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
  }

  public revalidateDocument(uri: string): void {
    const docContext = this.documentsCache.get(uri);
    if (docContext) {
      this.validateDocument(docContext);
    }
  }
}
