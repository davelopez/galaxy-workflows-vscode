import { BaseLanguageClient } from "vscode-languageclient";
import { CustomCommand, getCommandFullIdentifier } from ".";
import { WorkflowToolsTreeProvider } from "../providers/workflowToolsTreeProvider";

export class RefreshToolsViewCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("refreshToolsView");
  readonly identifier: string = RefreshToolsViewCommand.id;
  private readonly provider: WorkflowToolsTreeProvider;

  constructor(client: BaseLanguageClient, provider: WorkflowToolsTreeProvider) {
    super(client);
    this.provider = provider;
  }

  async execute(): Promise<void> {
    await this.provider.refresh();
  }
}
