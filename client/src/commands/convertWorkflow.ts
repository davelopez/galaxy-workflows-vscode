import { BaseLanguageClient } from "vscode-languageclient";
import { commands, languages, window, workspace } from "vscode";
import { CustomCommand, getCommandFullIdentifier } from ".";
import { Constants } from "../common/constants";
import { ConvertWorkflowContentsParams, ConvertWorkflowContentsResult, LSRequestIdentifiers } from "../languageTypes";
import {
  ConvertedWorkflowDocumentProvider,
  toConvertedWorkflowUri,
} from "../providers/convertedWorkflowDocumentProvider";

abstract class ConvertWorkflowCommandBase extends CustomCommand {
  constructor(
    client: BaseLanguageClient,
    private readonly convertedProvider: ConvertedWorkflowDocumentProvider
  ) {
    super(client);
  }

  protected abstract readonly targetFormat: "format2" | "native";
  protected abstract readonly convertedTitle: string;

  async execute(): Promise<void> {
    if (!window.activeTextEditor) return;
    const { document } = window.activeTextEditor;

    const params: ConvertWorkflowContentsParams = {
      contents: document.getText(),
      targetFormat: this.targetFormat,
    };

    let result: ConvertWorkflowContentsResult | undefined;
    try {
      result = await this.client.sendRequest<ConvertWorkflowContentsResult>(
        LSRequestIdentifiers.CONVERT_WORKFLOW_CONTENTS,
        params
      );
    } catch (err) {
      window.showErrorMessage(`Conversion failed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    if (!result) {
      window.showErrorMessage("Conversion failed: server returned no result.");
      return;
    }
    if (result.error) {
      window.showErrorMessage(`Conversion failed: ${result.error}`);
      return;
    }

    const originalUri = document.uri;
    const convertedUri = toConvertedWorkflowUri(originalUri);

    this.convertedProvider.setContents(convertedUri, result.contents);

    // Must open + set language before vscode.diff — custom URI schemes bypass
    // VSCode's file-extension language detection.
    const convertedDoc = await workspace.openTextDocument(convertedUri);
    const targetLanguageId =
      this.targetFormat === "format2"
        ? Constants.GXFORMAT2_WORKFLOW_LANGUAGE_ID
        : Constants.NATIVE_WORKFLOW_LANGUAGE_ID;
    await languages.setTextDocumentLanguage(convertedDoc, targetLanguageId);

    await commands.executeCommand(
      "vscode.diff",
      originalUri,
      convertedUri,
      `${document.fileName} ↔ ${this.convertedTitle}`
    );
  }
}

export class ConvertToFormat2Command extends ConvertWorkflowCommandBase {
  public static id = getCommandFullIdentifier("convertToFormat2");
  readonly identifier = ConvertToFormat2Command.id;
  protected readonly targetFormat = "format2" as const;
  protected readonly convertedTitle = "Converted (Format2)";
}

export class ConvertToNativeCommand extends ConvertWorkflowCommandBase {
  public static id = getCommandFullIdentifier("convertToNative");
  readonly identifier = ConvertToNativeCommand.id;
  protected readonly targetFormat = "native" as const;
  protected readonly convertedTitle = "Converted (Native .ga)";
}
