import { ProgressLocation, window } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { CustomCommand, getCommandFullIdentifier } from ".";
import { LSRequestIdentifiers, PopulateToolCacheResult } from "../languageTypes";

interface PopulateForToolArgs {
  toolId: string;
  toolVersion?: string;
}

export class PopulateToolCacheForToolCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("populateToolCacheForTool");
  readonly identifier: string = PopulateToolCacheForToolCommand.id;
  private readonly format2Client: BaseLanguageClient;

  constructor(nativeClient: BaseLanguageClient, format2Client: BaseLanguageClient) {
    super(nativeClient);
    this.format2Client = format2Client;
  }

  async execute(args: unknown[]): Promise<void> {
    const arg = args[0] as PopulateForToolArgs | undefined;
    if (!arg?.toolId) {
      window.showErrorMessage("Populate Tool Cache: missing tool id.");
      return;
    }
    const { toolId, toolVersion } = arg;

    // Both servers share the on-disk tool cache but keep their own
    // in-memory resolution-failed flag, so dispatch to both so each clears
    // its flag on a successful retry and re-renders its CodeLenses.
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `Populating tool cache for ${toolId}…`,
        cancellable: false,
      },
      async () => {
        const [nativeResult, format2Result] = await Promise.all([
          this.client.sendRequest<PopulateToolCacheResult>(LSRequestIdentifiers.POPULATE_TOOL_CACHE_FOR_TOOL, {
            toolId,
            toolVersion,
          }),
          this.format2Client.sendRequest<PopulateToolCacheResult>(LSRequestIdentifiers.POPULATE_TOOL_CACHE_FOR_TOOL, {
            toolId,
            toolVersion,
          }),
        ]);
        const result = nativeResult ?? format2Result;
        if (!result) {
          window.showErrorMessage(`Tool cache retry failed for ${toolId}: server returned no result.`);
          return;
        }
        const anyFetched = (nativeResult?.fetched ?? 0) + (format2Result?.fetched ?? 0) > 0;
        const anyFailed = (nativeResult?.failed.length ?? 0) + (format2Result?.failed.length ?? 0) > 0;
        if (anyFailed && !anyFetched) {
          const error = nativeResult?.failed[0]?.error ?? format2Result?.failed[0]?.error ?? "resolution failed";
          window.showWarningMessage(`Could not resolve ${toolId}: ${error}`);
          return;
        }
        if (anyFetched) {
          window.showInformationMessage(`Tool cache: ${toolId} fetched.`);
        } else {
          window.showInformationMessage(`Tool cache: ${toolId} already cached.`);
        }
      }
    );
  }
}
