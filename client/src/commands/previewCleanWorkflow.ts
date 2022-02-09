import { window, workspace } from "vscode";
import { toCleanWorkflowUri } from "../providers/cleanWorkflowDocumentProvider";
import { CommandIds, CustomCommand } from "./common";

export class PreviewCleanWorkflowCommand extends CustomCommand {
  readonly identifier: string = CommandIds.PREVIEW_CLEAN_WORKFLOW;

  async execute(args: any[]): Promise<void> {
    if (!window.activeTextEditor) {
      return;
    }
    const { document } = window.activeTextEditor;
    const cleanWorkflowUri = toCleanWorkflowUri(document.uri);
    const doc = await workspace.openTextDocument(cleanWorkflowUri);
    await window.showTextDocument(doc, { preview: true });
  }
}
