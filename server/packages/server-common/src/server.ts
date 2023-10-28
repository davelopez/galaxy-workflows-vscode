import {
  Connection,
  InitializeParams,
  InitializeResult,
  ServerCapabilities,
  TextDocuments,
  WorkspaceFolder,
} from "vscode-languageserver";
import { TextDocument, WorkflowDocument, LanguageServiceBase, DocumentContext } from "./languageTypes";
import { DocumentsCache } from "./models/documentsCache";
import { FormattingProvider } from "./providers/formattingProvider";
import { HoverProvider } from "./providers/hover/hoverProvider";
import { SymbolsProvider } from "./providers/symbolsProvider";
import { CleanWorkflowService } from "./services/cleanWorkflow";
// import { DebugHoverContentContributor } from "./providers/hover/debugHoverContentContributor";
import { ConfigService } from "./configService";
import { CompletionProvider } from "./providers/completionProvider";
import { ValidationProfiles } from "./providers/validation/profiles";
import { WorkflowTestsDocument } from "./models/workflowTestsDocument";

export class GalaxyWorkflowLanguageServer {
  public readonly configService: ConfigService;
  public readonly documents = new TextDocuments(TextDocument);
  public readonly documentsCache = new DocumentsCache();
  protected workspaceFolders: WorkspaceFolder[] | null | undefined;
  private languageServiceMapper: Map<string, LanguageServiceBase<DocumentContext>> = new Map();

  constructor(
    public readonly connection: Connection,
    workflowLanguageService: LanguageServiceBase<WorkflowDocument>,
    workflowTestsLanguageService: LanguageServiceBase<WorkflowTestsDocument>
  ) {
    this.languageServiceMapper.set(workflowLanguageService.languageId, workflowLanguageService);
    this.languageServiceMapper.set(workflowTestsLanguageService.languageId, workflowTestsLanguageService);

    this.configService = new ConfigService(connection, () => this.onConfigurationChanged());
    // Track open, change and close text document events
    this.trackDocumentChanges(connection);

    this.connection.onInitialize((params) => this.initialize(params));

    this.registerProviders();

    this.registerServices();

    this.connection.onShutdown(() => this.cleanup());
  }

  public start(): void {
    this.connection.listen();
  }

  public getLanguageServiceById(languageId: string): LanguageServiceBase<DocumentContext> {
    const languageService = this.languageServiceMapper.get(languageId);
    if (!languageService) {
      throw new Error(`Language service not found for languageId: ${languageId}`);
    }
    return languageService;
  }

  private async initialize(params: InitializeParams): Promise<InitializeResult> {
    this.configService.initialize(params.capabilities);
    this.workspaceFolders = params.workspaceFolders;

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

  private registerProviders(): void {
    FormattingProvider.register(this);
    HoverProvider.register(this, [
      // new DebugHoverContentContributor(), //TODO remove this contributor before release
    ]);
    SymbolsProvider.register(this);
    CompletionProvider.register(this);
  }

  private registerServices(): void {
    CleanWorkflowService.register(this);
  }

  private trackDocumentChanges(connection: Connection): void {
    this.documents.listen(connection);
    this.documents.onDidChangeContent((event) => this.onDidChangeContent(event.document));
    this.documents.onDidClose((event) => this.onDidClose(event.document));
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
    this.documentsCache.all().forEach((workflowDocument) => {
      this.validateDocument(workflowDocument);
    });
  }

  private cleanup(): void {
    this.documentsCache.dispose();
  }

  private async validateDocument(workflowDocument: DocumentContext): Promise<void> {
    if (DocumentsCache.schemesToSkip.includes(workflowDocument.uri.scheme)) {
      return;
    }
    const settings = await this.configService.getDocumentSettings(workflowDocument.textDocument.uri);
    const validationProfile = ValidationProfiles.get(settings.validation.profile);
    const languageService = this.getLanguageServiceById(workflowDocument.languageId);
    languageService.validate(workflowDocument, validationProfile).then((diagnostics) => {
      this.connection.sendDiagnostics({ uri: workflowDocument.textDocument.uri, diagnostics });
    });
  }

  private clearValidation(textDocument: TextDocument): void {
    this.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
  }
}
