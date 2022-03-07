import { ExtensionContext } from "vscode";
import { CommonLanguageClient, LanguageClientOptions } from "vscode-languageclient";
import { setupCommands } from "./commands/setup";
import { Constants } from "./constants";
import { CleanWorkflowDocumentProvider } from "./providers/cleanWorkflowDocumentProvider";
import { CleanWorkflowProvider } from "./providers/cleanWorkflowProvider";

export function buildLanguageClientOptions() {
  const documentSelector = [{ language: Constants.NATIVE_WORKFLOW_LANGUAGE_ID }];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {},
    initializationOptions: {},
  };
  return clientOptions;
}

export function initExtension(context: ExtensionContext, client: CommonLanguageClient) {
  setupProviders(context, client);
  setupCommands(context, client);

  const disposable = client.start();
  context.subscriptions.push(disposable);

  client.onReady().then(() => {
    console.log(`${context.extension.id} server is ready.`);
  });
}

function setupProviders(context: ExtensionContext, client: CommonLanguageClient) {
  const cleanWorkflowProvider = new CleanWorkflowProvider(client);
  CleanWorkflowDocumentProvider.register(context, cleanWorkflowProvider);
}
