import { ExtensionContext, Uri } from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/browser";
import { buildLanguageClientOptions, initExtension } from "../common";

export function activate(context: ExtensionContext): void {
  const client = buildWebLanguageClient(context);

  initExtension(context, client);
}

export function deactivate(): void {
  // Nothing to do yet
}

function buildWebLanguageClient(context: ExtensionContext): LanguageClient {
  const clientOptions: LanguageClientOptions = buildLanguageClientOptions();
  const serverPath = Uri.joinPath(context.extensionUri, "server/dist/web/nativeServer.js");
  const worker = new Worker(serverPath.toString());
  return new LanguageClient("galaxy-workflow-language-client-native", "Galaxy Workflows LS", clientOptions, worker);
}
