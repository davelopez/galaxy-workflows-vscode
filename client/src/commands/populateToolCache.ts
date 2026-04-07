import { ProgressLocation, window } from "vscode";
import { CustomCommand, getCommandFullIdentifier } from ".";
import {
  GetWorkflowToolIdsResult,
  LSRequestIdentifiers,
  PopulateToolCacheParams,
  PopulateToolCacheResult,
} from "../languageTypes";

export class PopulateToolCacheCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("populateToolCache");
  readonly identifier: string = PopulateToolCacheCommand.id;

  async execute(): Promise<void> {
    await window.withProgress(
      { location: ProgressLocation.Notification, title: "Populating Galaxy tool cache…", cancellable: false },
      async () => {
        // 1. Collect tool refs from all open workflow documents
        const toolIdsResult = await this.client.sendRequest<GetWorkflowToolIdsResult>(
          LSRequestIdentifiers.GET_WORKFLOW_TOOL_IDS
        );
        const tools = toolIdsResult?.tools ?? [];

        if (tools.length === 0) {
          window.showInformationMessage("No tools found in open workflow documents.");
          return;
        }

        // 2. Ask server to populate the cache
        const params: PopulateToolCacheParams = { tools };
        const result = await this.client.sendRequest<PopulateToolCacheResult>(
          LSRequestIdentifiers.POPULATE_TOOL_CACHE,
          params
        );

        if (!result) {
          window.showErrorMessage("Tool cache population failed: server returned no result.");
          return;
        }

        const { fetched, alreadyCached, failed } = result;
        const parts: string[] = [];
        if (fetched > 0) parts.push(`${fetched} fetched`);
        if (alreadyCached > 0) parts.push(`${alreadyCached} already cached`);
        if (failed.length > 0) parts.push(`${failed.length} failed`);
        const summary = parts.join(", ") || "nothing to do";
        window.showInformationMessage(`Tool cache: ${summary}.`);
      }
    );
  }
}
