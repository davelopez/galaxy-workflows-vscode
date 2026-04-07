import { Disposable, StatusBarAlignment, StatusBarItem, window } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { GetToolCacheStatusResult, LSRequestIdentifiers } from "./languageTypes";
import { PopulateToolCacheCommand } from "./commands/populateToolCache";

/**
 * Status bar item showing the number of tools in the local Galaxy tool cache.
 * Clicking the item triggers the Populate Tool Cache command.
 */
export class ToolCacheStatusBar implements Disposable {
  private readonly item: StatusBarItem;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly client: BaseLanguageClient) {
    this.item = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    this.item.command = PopulateToolCacheCommand.id;
    this.item.tooltip = "Galaxy Tool Cache — click to populate";
  }

  async refresh(): Promise<void> {
    try {
      const status = await this.client.sendRequest<GetToolCacheStatusResult>(
        LSRequestIdentifiers.GET_TOOL_CACHE_STATUS
      );
      this.item.text = `$(database) Tools: ${status?.cacheSize ?? 0}`;
      this.item.show();
    } catch {
      this.item.hide();
    }
  }

  startPolling(intervalMs = 30_000): void {
    void this.refresh();
    this.refreshTimer = setInterval(() => void this.refresh(), intervalMs);
  }

  dispose(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.item.dispose();
  }
}
