import {
  Connection,
  InitializeParams,
  InitializeResult,
  ServerCapabilities,
  TextDocuments,
  WorkspaceFolder,
} from "vscode-languageserver";
import { WorkflowLanguageService, TextDocument } from "./languageTypes";
import { WorkflowDocuments } from "./models/workflowDocuments";
import { FormattingProvider } from "./providers/formattingProvider";

export class GalaxyWorkflowLanguageServer {
  public readonly languageService: WorkflowLanguageService;
  public readonly documents = new TextDocuments(TextDocument);
  public readonly workflowDocuments = new WorkflowDocuments();
  protected workspaceFolders: WorkspaceFolder[] | null | undefined;

  constructor(public readonly connection: Connection, languageService: WorkflowLanguageService) {
    this.languageService = languageService;
    // Track open, change and close text document events
    this.trackDocumentChanges(connection);

    this.connection.onInitialize((params) => this.initialize(params));

    this.registerProviders();

    this.connection.onShutdown(() => this.cleanup());
  }

  public start(): void {
    this.connection.listen();
  }

  private async initialize(params: InitializeParams): Promise<InitializeResult> {
    this.workspaceFolders = params.workspaceFolders;

    const capabilities: ServerCapabilities = {
      documentFormattingProvider: true,
    };

    return {
      capabilities,
    };
  }

  private registerProviders() {
    FormattingProvider.register(this);
  }

  private trackDocumentChanges(connection: Connection) {
    this.documents.listen(connection);
    this.documents.onDidOpen((event) => this.onDocumentOpen(event.document));
    this.documents.onDidChangeContent((event) => this.onDidChangeContent(event.document));
    this.documents.onDidClose((event) => this.onDidClose(event.document));
  }

  private onDocumentOpen(document: TextDocument) {
    const workflowDocument = this.languageService.parseWorkflowDocument(document);
    this.workflowDocuments.addOrReplaceWorkflowDocument(workflowDocument);
  }

  private onDidChangeContent(document: TextDocument) {
    //TODO
  }

  private onDidClose(document: TextDocument) {
    this.workflowDocuments.removeWorkflowDocument(document.uri);
  }

  private cleanup() {
    this.workflowDocuments.dispose();
  }
}
