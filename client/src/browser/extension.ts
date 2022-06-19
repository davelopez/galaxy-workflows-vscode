import { ExtensionContext, Uri } from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/browser";
import { buildBasicLanguageClientOptions, initExtension } from "../common";
import { Constants } from "../common/constants";

export function activate(context: ExtensionContext): void {
  const nativeLanguageClient = createWebWorkerLanguageClient(
    Constants.NATIVE_WORKFLOW_LANGUAGE_ID,
    Uri.joinPath(context.extensionUri, "server/gx-workflow-ls-native/dist/web/nativeServer.js")
  );
  const gxFormat2LanguageClient = createWebWorkerLanguageClient(
    Constants.GXFORMAT2_WORKFLOW_LANGUAGE_ID,
    Uri.joinPath(context.extensionUri, "server/gx-workflow-ls-format2/dist/web/gxFormat2Server.js")
  );

  initExtension(context, nativeLanguageClient, gxFormat2LanguageClient);
}

export function deactivate(): void {
  // Nothing to do yet
}

function createWebWorkerLanguageClient(languageId: string, serverUri: Uri): LanguageClient {
  const documentSelector = [{ language: languageId }];
  const clientOptions: LanguageClientOptions = buildBasicLanguageClientOptions(documentSelector);
  const worker = new Worker(serverUri.toString());
  return new LanguageClient(`${languageId}-language-client`, `Galaxy Workflows (${languageId})`, clientOptions, worker);
}
