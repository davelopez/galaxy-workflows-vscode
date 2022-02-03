import { commands, ExtensionContext, Uri, window, workspace } from "vscode";
import { Constants } from "../constants";
import { CommandIds } from "./common";

export function setupCommands(context: ExtensionContext) {
  let disposable = commands.registerCommand(CommandIds.PREVIEW_CLEAN_WORKFLOW, async () => {
    if (!window.activeTextEditor) {
      return;
    }
    const { document } = window.activeTextEditor;
    const cleanWorkflowUri = Uri.parse(`${Constants.CLEAN_WORKFLOW_DOCUMENT_SCHEME}:${document.uri.path}`);
    const doc = await workspace.openTextDocument(cleanWorkflowUri);
    await window.showTextDocument(doc, { preview: true });
  });
  context.subscriptions.push(disposable);

  disposable = commands.registerCommand(CommandIds.COMPARE_CLEAN_WORKFLOW, () => {
    if (!window.activeTextEditor) {
      return;
    }
    const { document } = window.activeTextEditor;
    const cleanWorkflowUri = Uri.parse(`${Constants.CLEAN_WORKFLOW_DOCUMENT_SCHEME}:${document.uri.path}`);
    commands.executeCommand("vscode.diff", document.uri, cleanWorkflowUri);
  });
  context.subscriptions.push(disposable);
}
