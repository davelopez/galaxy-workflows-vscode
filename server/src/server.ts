import {
  Connection,
  InitializeParams,
  InitializeResult,
  ServerCapabilities,
  TextDocuments,
  WorkspaceFolder,
} from "vscode-languageserver";
import { CleanWorkflowService } from "./services/cleanWorkflow";
import { WorkflowLanguageService, TextDocument, WorkflowDocument } from "./languageTypes";
import { WorkflowDocuments } from "./models/workflowDocuments";
import { SymbolsProvider } from "./providers/symbolsProvider";
import { FormattingProvider } from "./providers/formattingProvider";
import { HoverProvider } from "./providers/hover/hoverProvider";
// import { DebugHoverContentContributor } from "./providers/hover/debugHoverContentContributor";
import { CompletionProvider } from "./providers/completionProvider";
import { ConfigService } from "./configService";
import { ValidationProfiles } from "./providers/validation/profiles";

export class GalaxyWorkflowLanguageServer {
  public readonly languageService: WorkflowLanguageService;
  public readonly configService: ConfigService;
  public readonly documents = new TextDocuments(TextDocument);
  public readonly workflowDocuments = new WorkflowDocuments();
  protected workspaceFolders: WorkspaceFolder[] | null | undefined;

  constructor(public readonly connection: Connection, languageService: WorkflowLanguageService) {
    this.languageService = languageService;
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
    const workflowDocument = this.languageService.parseWorkflowDocument(textDocument);
    this.workflowDocuments.addOrReplaceWorkflowDocument(workflowDocument);
    this.validate(workflowDocument);
  }

  private onDidClose(textDocument: TextDocument): void {
    this.workflowDocuments.removeWorkflowDocument(textDocument.uri);
    this.configService.onDocumentClose(textDocument.uri);
    this.clearValidation(textDocument);
  }

  private onConfigurationChanged(): void {
    this.workflowDocuments.all().forEach((workflowDocument) => {
      this.validate(workflowDocument);
    });
  }

  private cleanup(): void {
    this.workflowDocuments.dispose();
  }

  private async validate(workflowDocument: WorkflowDocument): Promise<void> {
    if (WorkflowDocuments.schemesToSkip.includes(workflowDocument.uri.scheme)) {
      return;
    }
    const settings = await this.configService.getDocumentSettings(workflowDocument.textDocument.uri);
    const validationProfile = ValidationProfiles.get(settings.validation.profile);
    this.languageService.validate(workflowDocument, validationProfile).then((diagnostics) => {
      this.connection.sendDiagnostics({ uri: workflowDocument.textDocument.uri, diagnostics });
    });
  }

  private clearValidation(textDocument: TextDocument): void {
    this.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
  }
}
