import { commands } from "vscode";
import { ComparableWorkflow, ComparableWorkflowProvider, CustomCommand, getCommandFullIdentifier } from "./common";

/**
 * Command to select a workflow for comparison with another. This workflow will
 * be the left part of the diff.
 */
export class SelectForCleanCompareCommand extends CustomCommand implements ComparableWorkflowProvider {
  public static id = getCommandFullIdentifier("selectForCleanCompare");
  readonly identifier: string = SelectForCleanCompareCommand.id;

  private static _selectedForCompare: ComparableWorkflow | undefined;

  public async execute(args: any[]): Promise<void> {
    SelectForCleanCompareCommand._selectedForCompare = ComparableWorkflow.buildFromArgs(args);
    await commands.executeCommand(
      "setContext",
      "galaxy-workflows.selectForCleanCompare",
      SelectForCleanCompareCommand._selectedForCompare !== undefined
    );
  }

  public getSelectedForCompare(): ComparableWorkflow | undefined {
    return SelectForCleanCompareCommand._selectedForCompare;
  }
}
