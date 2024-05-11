import { window } from "vscode";
import { CustomCommand, getCommandFullIdentifier } from ".";
import {
  CleanWorkflowDocumentParams,
  CleanWorkflowDocumentResult,
  LSRequestIdentifiers,
} from "../../../shared/src/requestsDefinitions";

/**
 * Command to 'clean' the selected workflow document.
 * It will apply edits to remove the non-workflow logic related parts.
 */
export class CleanWorkflowCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("cleanWorkflow");
  readonly identifier: string = CleanWorkflowCommand.id;

  async execute(): Promise<void> {
    if (!window.activeTextEditor) {
      return;
    }
    const { document } = window.activeTextEditor;

    const params: CleanWorkflowDocumentParams = { uri: this.client.code2ProtocolConverter.asUri(document.uri) };
    const result = await this.client.sendRequest<CleanWorkflowDocumentResult>(
      LSRequestIdentifiers.CLEAN_WORKFLOW_DOCUMENT,
      params
    );
    if (!result) {
      throw new Error("Cannot clean the requested document. The server returned no result.");
    }
    if (result.error) {
      throw new Error(result.error);
    }
  }
}
