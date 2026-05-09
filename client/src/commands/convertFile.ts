import { window, workspace, WorkspaceEdit } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { CustomCommand, getCommandFullIdentifier } from ".";
import { convertedFileUri, fileUriExistsInWorkspace } from "../common/utils";
import { URI } from "vscode-uri";
import { requestConversion } from "./convertWorkflow";

/**
 * Converts the active workflow file to the opposite format in-place:
 * creates the converted file and deletes the original in a single WorkspaceEdit
 * so the operation is atomic and undoable.
 *
 * When args[0] is `{ confirmed: true }` the confirmation dialog is skipped
 * (used by E2E tests).
 */
abstract class ConvertFileCommandBase extends CustomCommand {
  constructor(client: BaseLanguageClient) {
    super(client);
  }

  protected abstract readonly targetFormat: "format2" | "native";

  async execute(args: unknown[]): Promise<void> {
    if (!window.activeTextEditor) return;
    const { document } = window.activeTextEditor;

    const sourceUri = document.uri;
    const targetUri = convertedFileUri(sourceUri, this.targetFormat);

    if (await fileUriExistsInWorkspace(URI.parse(targetUri.toString()))) {
      const targetName = targetUri.path.split("/").pop() ?? targetUri.path;
      window.showErrorMessage(`Cannot convert: ${targetName} already exists. Remove it first or use Export instead.`);
      return;
    }

    const skipConfirm = (args[0] as Record<string, unknown> | undefined)?.confirmed === true;
    if (!skipConfirm) {
      const sourceName = sourceUri.path.split("/").pop() ?? sourceUri.path;
      const targetName = targetUri.path.split("/").pop() ?? targetUri.path;
      const choice = await window.showWarningMessage(
        `Convert ${sourceName} to ${targetName}? The original file will be deleted.`,
        "Convert",
        "Cancel"
      );
      if (choice !== "Convert") return;
    }

    const result = await requestConversion(this.client, document.getText(), this.targetFormat, true);
    if (!result) return;

    const edit = new WorkspaceEdit();
    edit.createFile(targetUri, { contents: Buffer.from(result.contents, "utf8") });
    edit.deleteFile(sourceUri);
    try {
      await workspace.applyEdit(edit);
      const doc = await workspace.openTextDocument(targetUri);
      await window.showTextDocument(doc);
    } catch (error) {
      window.showErrorMessage(`Failed to convert file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export class ConvertFileToFormat2Command extends ConvertFileCommandBase {
  public static id = getCommandFullIdentifier("convertFileToFormat2");
  readonly identifier = ConvertFileToFormat2Command.id;
  protected readonly targetFormat = "format2" as const;
}

export class ConvertFileToNativeCommand extends ConvertFileCommandBase {
  public static id = getCommandFullIdentifier("convertFileToNative");
  readonly identifier = ConvertFileToNativeCommand.id;
  protected readonly targetFormat = "native" as const;
}
