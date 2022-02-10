import { ExtensionContext, Uri } from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/browser";
import { setupCommands } from "../commands/setup";
import { Constants } from "../constants";
import { CleanWorkflowDocumentProvider } from "../providers/cleanWorkflowDocumentProvider";

export function activate(context: ExtensionContext) {
  console.log(`${context.extension.id} is now active in the web extension host.`);

  const client = startLanguageClient(context);

  setupProviders(context, client);

  setupCommands(context, client);
}

export function deactivate() {}

function startLanguageClient(context: ExtensionContext) {
  const documentSelector = [{ language: Constants.NATIVE_WORKFLOW_LANGUAGE_ID }];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {},
    initializationOptions: {},
  };

  const client = createWorkerLanguageClient(context, clientOptions);

  const disposable = client.start();
  context.subscriptions.push(disposable);

  client.onReady().then(() => {
    console.log(`${context.extension.id} server is ready.`);
  });
  return client;
}

function createWorkerLanguageClient(context: ExtensionContext, clientOptions: LanguageClientOptions) {
  const worker = createServerWorker(context);
  return new LanguageClient("galaxy-workflow-language-client-native", "Galaxy Workflows LS", clientOptions, worker);
}

function createServerWorker(context: ExtensionContext) {
  // The worker main file implements the language server.
  const serverMain = Uri.joinPath(context.extensionUri, "server/dist/browserServerMain.js");
  const worker = new Worker(serverMain.toString());
  return worker;
}

function setupProviders(context: ExtensionContext, client: LanguageClient) {
  CleanWorkflowDocumentProvider.register(context, client);
}
