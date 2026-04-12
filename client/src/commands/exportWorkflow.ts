import { window, workspace } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { CustomCommand, getCommandFullIdentifier } from ".";
import { convertedFileUri, fileUriExistsInWorkspace } from "../common/utils";
import { URI } from "vscode-uri";
import { requestConversion } from "./convertWorkflow";

/**
 * Exports the active workflow as a new file in the opposite format (clean + convert).
 * The original file is left unchanged.
 */
abstract class ExportWorkflowCommandBase extends CustomCommand {
  constructor(client: BaseLanguageClient) {
    super(client);
  }

  protected abstract readonly targetFormat: "format2" | "native";

  async execute(): Promise<void> {
    if (!window.activeTextEditor) return;
    const { document } = window.activeTextEditor;

    const result = await requestConversion(this.client, document.getText(), this.targetFormat, true);
    if (!result) return;

    const targetUri = convertedFileUri(document.uri, this.targetFormat);

    if (await fileUriExistsInWorkspace(URI.parse(targetUri.toString()))) {
      const targetName = targetUri.path.split("/").pop() ?? targetUri.path;
      const choice = await window.showWarningMessage(
        `${targetName} already exists. Overwrite?`,
        "Overwrite",
        "Cancel"
      );
      if (choice !== "Overwrite") return;
    }

    await workspace.fs.writeFile(targetUri, Buffer.from(result.contents, "utf8"));
    const doc = await workspace.openTextDocument(targetUri);
    await window.showTextDocument(doc);
  }
}

export class ExportToFormat2Command extends ExportWorkflowCommandBase {
  public static id = getCommandFullIdentifier("exportToFormat2");
  readonly identifier = ExportToFormat2Command.id;
  protected readonly targetFormat = "format2" as const;
}

export class ExportToNativeCommand extends ExportWorkflowCommandBase {
  public static id = getCommandFullIdentifier("exportToNative");
  readonly identifier = ExportToNativeCommand.id;
  protected readonly targetFormat = "native" as const;
}
