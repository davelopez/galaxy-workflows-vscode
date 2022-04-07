import {
  Connection,
  InitializeParams,
  InitializeResult,
  ServerCapabilities,
  TextDocuments,
  WorkspaceFolder,
} from "vscode-languageserver";
import { CleanWorkflowCommand } from "./commands/cleanWorkflow";
import { WorkflowLanguageService, TextDocument, WorkflowDocument } from "./languageTypes";
import { WorkflowDocuments } from "./models/workflowDocuments";
import { SymbolsProvider } from "./providers/symbolsProvider";
import { FormattingProvider } from "./providers/formattingProvider";
import { HoverProvider } from "./providers/hover/hoverProvider";
import { DebugHoverContentContributor } from "./providers/hover/debugHoverContentContributor";

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

    this.registerCommands();

    this.connection.onShutdown(() => this.cleanup());
  }

  public start(): void {
    this.connection.listen();
  }

  private async initialize(params: InitializeParams): Promise<InitializeResult> {
    this.workspaceFolders = params.workspaceFolders;

    const capabilities: ServerCapabilities = {
      documentFormattingProvider: true,
      hoverProvider: true,
      documentSymbolProvider: true,
    };

    return {
      capabilities,
    };
  }

  private registerProviders() {
    FormattingProvider.register(this);
    HoverProvider.register(this, [
      // new DebugHoverContentContributor(), //TODO remove this contributor before release
    ]);
    SymbolsProvider.register(this);
  }

  private registerCommands() {
    CleanWorkflowCommand.register(this);
  }

  private trackDocumentChanges(connection: Connection) {
    this.documents.listen(connection);
    this.documents.onDidOpen((event) => this.onDocumentOpen(event.document));
    this.documents.onDidChangeContent((event) => this.onDidChangeContent(event.document));
    this.documents.onDidClose((event) => this.onDidClose(event.document));
  }

  private onDocumentOpen(textDocument: TextDocument) {
    const workflowDocument = this.languageService.parseWorkflowDocument(textDocument);
    this.workflowDocuments.addOrReplaceWorkflowDocument(workflowDocument);
    this.validate(workflowDocument);
  }

  private onDidChangeContent(textDocument: TextDocument) {
    const workflowDocument = this.languageService.parseWorkflowDocument(textDocument);
    this.workflowDocuments.addOrReplaceWorkflowDocument(workflowDocument);
    this.validate(workflowDocument);
  }

  private onDidClose(textDocument: TextDocument) {
    this.workflowDocuments.removeWorkflowDocument(textDocument.uri);
    this.clearValidation(textDocument);
  }

  private cleanup() {
    this.workflowDocuments.dispose();
  }

  private validate(workflowDocument: WorkflowDocument) {
    this.languageService.doValidation(workflowDocument).then((diagnostics) => {
      this.connection.sendDiagnostics({ uri: workflowDocument.textDocument.uri, diagnostics });
    });
  }

  private clearValidation(textDocument: TextDocument) {
    this.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
  }
}
