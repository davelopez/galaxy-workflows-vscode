import { window, workspace } from "vscode";
import { toCleanWorkflowUri } from "../providers/cleanWorkflowDocumentProvider";
import { CustomCommand, getCommandFullIdentifier } from ".";

/**
 * Command to display a 'clean' version of the selected workflow document.
 */
export class PreviewCleanWorkflowCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("previewCleanWorkflow");
  readonly identifier: string = PreviewCleanWorkflowCommand.id;

  async execute(): Promise<void> {
    if (!window.activeTextEditor) {
      return;
    }
    const { document } = window.activeTextEditor;
    const cleanWorkflowUri = toCleanWorkflowUri(document.uri);
    const doc = await workspace.openTextDocument(cleanWorkflowUri);
    await window.showTextDocument(doc, { preview: true });
  }
}
