import { commands, ExtensionContext, TextDocument, Uri, window, workspace } from "vscode";
import { LanguageClient } from "vscode-languageclient/browser";
import { Constants } from "../constants";
import { CommandIds } from "./common";

export function setupCommands(context: ExtensionContext, client: LanguageClient) {
  let disposable = commands.registerCommand(CommandIds.PREVIEW_CLEAN_WORKFLOW, async () => {
    if (!window.activeTextEditor) {
      return;
    }
    const { document } = window.activeTextEditor;
    const cleanWorkflowUri = getCleanWorkflowUri(document);
    const doc = await workspace.openTextDocument(cleanWorkflowUri);
    await window.showTextDocument(doc, { preview: false });
  });

  context.subscriptions.push(disposable);

  disposable = commands.registerCommand(CommandIds.COMPARE_CLEAN_WORKFLOW, () => {
    if (!window.activeTextEditor) {
      return;
    }
    const { document } = window.activeTextEditor;
    const cleanWorkflowUri = getCleanWorkflowUri(document);
    commands.executeCommand("vscode.diff", document.uri, cleanWorkflowUri);
  });

  context.subscriptions.push(disposable);
}
function getCleanWorkflowUri(document: TextDocument) {
  return Uri.parse(document.uri.toString().replace(document.uri.scheme, Constants.CLEAN_WORKFLOW_DOCUMENT_SCHEME));
}
