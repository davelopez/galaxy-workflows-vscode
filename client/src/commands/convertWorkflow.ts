import { BaseLanguageClient } from "vscode-languageclient";
import { commands, languages, window, workspace } from "vscode";
import { CustomCommand, getCommandFullIdentifier } from ".";
import { Constants } from "../common/constants";
import { ConvertWorkflowContentsParams, ConvertWorkflowContentsResult, LSRequestIdentifiers } from "../languageTypes";
import {
  ConvertedWorkflowDocumentProvider,
  toConvertedWorkflowUri,
} from "../providers/convertedWorkflowDocumentProvider";

/**
 * Sends a conversion request to the language server.
 * @param client Language client
 * @param contents Workflow text to convert
 * @param targetFormat Target format
 * @param clean When true, clean the workflow before converting
 * @returns Conversion result or undefined on error (error already shown to user)
 */
export async function requestConversion(
  client: BaseLanguageClient,
  contents: string,
  targetFormat: "format2" | "native",
  clean = false
): Promise<ConvertWorkflowContentsResult | undefined> {
  const params: ConvertWorkflowContentsParams = { contents, targetFormat, clean };
  let result: ConvertWorkflowContentsResult | undefined;
  try {
    result = await client.sendRequest<ConvertWorkflowContentsResult>(
      LSRequestIdentifiers.CONVERT_WORKFLOW_CONTENTS,
      params
    );
  } catch (err) {
    window.showErrorMessage(`Conversion failed: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
  if (!result) {
    window.showErrorMessage("Conversion failed: server returned no result.");
    return undefined;
  }
  if (result.error) {
    window.showErrorMessage(`Conversion failed: ${result.error}`);
    return undefined;
  }
  return result;
}

/**
 * Opens a diff view comparing the original workflow with a preview of the converted version.
 */
abstract class PreviewConvertWorkflowCommandBase extends CustomCommand {
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

    const result = await requestConversion(this.client, document.getText(), this.targetFormat);
    if (!result) return;

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

export class PreviewConvertToFormat2Command extends PreviewConvertWorkflowCommandBase {
  public static id = getCommandFullIdentifier("previewConvertToFormat2");
  readonly identifier = PreviewConvertToFormat2Command.id;
  protected readonly targetFormat = "format2" as const;
  protected readonly convertedTitle = "Preview: Converted (Format2)";
}

export class PreviewConvertToNativeCommand extends PreviewConvertWorkflowCommandBase {
  public static id = getCommandFullIdentifier("previewConvertToNative");
  readonly identifier = PreviewConvertToNativeCommand.id;
  protected readonly targetFormat = "native" as const;
  protected readonly convertedTitle = "Preview: Converted (Native .ga)";
}
