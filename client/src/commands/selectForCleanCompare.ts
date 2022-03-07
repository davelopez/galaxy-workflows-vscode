import { commands } from "vscode";
import { ComparableWorkflow, ComparableWorkflowProvider, CustomCommand, getCommandFullIdentifier } from "./common";

export class SelectForCleanCompareCommand extends CustomCommand implements ComparableWorkflowProvider {
  public static id = getCommandFullIdentifier("selectForCleanCompare");
  readonly identifier: string = SelectForCleanCompareCommand.id;

  private static _selectedForCompare: ComparableWorkflow | undefined;

  async execute(args: any[]): Promise<void> {
    SelectForCleanCompareCommand._selectedForCompare = { uri: args[1], ref: args[0].ref };
    await commands.executeCommand("setContext", "galaxy-workflows.selectForCleanCompare", true);
  }

  public getSelectedForCompare(): ComparableWorkflow | undefined {
    return SelectForCleanCompareCommand._selectedForCompare;
  }
}
