import { commands, ExtensionContext } from "vscode";
import { CommonLanguageClient, LanguageClientOptions } from "vscode-languageclient";
import { setupCommands } from "../commands/setup";
import { Constants } from "./constants";
import { CleanWorkflowDocumentProvider } from "../providers/cleanWorkflowDocumentProvider";
import { CleanWorkflowProvider } from "../providers/cleanWorkflowProvider";
import { GitProvider } from "../providers/git";
import { BuiltinGitProvider } from "../providers/git/gitProvider";

export function buildLanguageClientOptions(): LanguageClientOptions {
  const documentSelector = [{ language: Constants.NATIVE_WORKFLOW_LANGUAGE_ID }];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {},
    initializationOptions: {},
  };
  return clientOptions;
}

export function initExtension(context: ExtensionContext, client: CommonLanguageClient): void {
  const gitProvider = new BuiltinGitProvider();
  setupProviders(context, client, gitProvider);
  setupCommands(context, client, gitProvider);

  const disposable = client.start();
  context.subscriptions.push(disposable);

  gitProvider.initialize().then(() => {
    commands.executeCommand("setContext", "galaxy-workflows.gitProviderInitialized", gitProvider.isInitialized);
    console.log(`${context.extension.id} Git initialized is ${gitProvider.isInitialized}.`);
  });

  client.onReady().then(() => {
    console.log(`${context.extension.id} server is ready.`);
  });
}

function setupProviders(context: ExtensionContext, client: CommonLanguageClient, gitProvider: GitProvider): void {
  const cleanWorkflowProvider = new CleanWorkflowProvider(client, gitProvider);
  CleanWorkflowDocumentProvider.register(context, cleanWorkflowProvider);
}
