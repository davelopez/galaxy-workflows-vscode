import { commands, ExtensionContext } from "vscode";
import { CommonLanguageClient, DocumentSelector, LanguageClientOptions } from "vscode-languageclient";
import { setupCommands } from "../commands/setup";
import { CleanWorkflowDocumentProvider } from "../providers/cleanWorkflowDocumentProvider";
import { CleanWorkflowProvider } from "../providers/cleanWorkflowProvider";
import { GitProvider } from "../providers/git";
import { BuiltinGitProvider } from "../providers/git/gitProvider";

export function buildBasicLanguageClientOptions(documentSelector: DocumentSelector): LanguageClientOptions {
  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {},
    initializationOptions: {},
  };
  return clientOptions;
}

export function initExtension(
  context: ExtensionContext,
  nativeClient: CommonLanguageClient,
  gxFormat2Client: CommonLanguageClient
): void {
  const gitProvider = initGitProvider(context);

  // Setup native workflow language features
  setupProviders(context, nativeClient, gitProvider);
  setupCommands(context, nativeClient, gitProvider);
  startLanguageClient(context, nativeClient);

  // Setup gxformat2 language features
  startLanguageClient(context, gxFormat2Client);
}

function initGitProvider(context: ExtensionContext): BuiltinGitProvider {
  const gitProvider = new BuiltinGitProvider();
  gitProvider.initialize().then(() => {
    commands.executeCommand("setContext", "galaxy-workflows.gitProviderInitialized", gitProvider.isInitialized);
    console.log(`${context.extension.id} Git initialized is ${gitProvider.isInitialized}.`);
  });
  return gitProvider;
}

function startLanguageClient(context: ExtensionContext, languageClient: CommonLanguageClient): void {
  const disposable = languageClient.start();
  context.subscriptions.push(disposable);

  languageClient.onReady().then(() => {
    console.log(`${context.extension.id} ${languageClient.outputChannel.name} server is ready.`);
  });
}

function setupProviders(context: ExtensionContext, client: CommonLanguageClient, gitProvider: GitProvider): void {
  const cleanWorkflowProvider = new CleanWorkflowProvider(client, gitProvider);
  CleanWorkflowDocumentProvider.register(context, cleanWorkflowProvider);
}
