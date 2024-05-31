import { ExtensionContext, Uri } from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/browser";
import { buildBasicLanguageClientOptions, initExtension } from "../common";
import { Constants } from "../common/constants";

let nativeLanguageClient: LanguageClient;
let gxFormat2LanguageClient: LanguageClient;

export function activate(context: ExtensionContext): void {
  nativeLanguageClient = createWebWorkerLanguageClient(
    [Constants.NATIVE_WORKFLOW_LANGUAGE_ID],
    Uri.joinPath(context.extensionUri, "server/gx-workflow-ls-native/dist/web/nativeServer.js")
  );
  gxFormat2LanguageClient = createWebWorkerLanguageClient(
    [Constants.GXFORMAT2_WORKFLOW_LANGUAGE_ID, Constants.GXFORMAT2_WORKFLOW_TESTS_LANGUAGE_ID],
    Uri.joinPath(context.extensionUri, "server/gx-workflow-ls-format2/dist/web/gxFormat2Server.js")
  );

  initExtension(context, nativeLanguageClient, gxFormat2LanguageClient);
}

export async function deactivate(): Promise<void> {
  await nativeLanguageClient?.stop();
  await gxFormat2LanguageClient?.stop();
}

function createWebWorkerLanguageClient(languageIds: string[], serverUri: Uri): LanguageClient {
  const documentSelector = languageIds.map((languageId) => ({ language: languageId }));
  const clientOptions: LanguageClientOptions = buildBasicLanguageClientOptions(documentSelector);
  const worker = new Worker(serverUri.toString());
  return new LanguageClient(
    `${languageIds}-language-client`,
    `Galaxy Workflows (${languageIds})`,
    clientOptions,
    worker
  );
}
