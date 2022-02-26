import { ExtensionContext, Uri } from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/browser";
import { buildLanguageClientOptions, initExtension } from "../common";

export function activate(context: ExtensionContext) {
  console.log(`${context.extension.id} is now active in the web extension host.`);

  const client = startLanguageClient(context);

  initExtension(context, client);
}

export function deactivate() {}

function startLanguageClient(context: ExtensionContext) {
  const clientOptions: LanguageClientOptions = buildLanguageClientOptions();

  const client = createWorkerLanguageClient(context, clientOptions);

  const disposable = client.start();
  context.subscriptions.push(disposable);

  client.onReady().then(() => {
    console.log(`${context.extension.id} server is ready.`);
  });
  return client;
}

function createWorkerLanguageClient(context: ExtensionContext, clientOptions: LanguageClientOptions) {
  const serverMain = Uri.joinPath(context.extensionUri, "server/dist/web/nativeServer.js");
  const worker = new Worker(serverMain.toString());
  return new LanguageClient("galaxy-workflow-language-client-native", "Galaxy Workflows LS", clientOptions, worker);
}
