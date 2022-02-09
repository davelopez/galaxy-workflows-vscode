import { commands } from "vscode";
import { toCleanWorkflowUri } from "../providers/cleanWorkflowDocumentProvider";
import { debugPrintCommandArgs } from "../utils";
import { CustomCommand, getCommandFullIdentifier } from "./common";

export class CompareCleanWorkflowsCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("compareCleanWorkflows");
  readonly identifier: string = CompareCleanWorkflowsCommand.id;

  async execute(args: any[]): Promise<void> {
    debugPrintCommandArgs(this.identifier, args, this.client.outputChannel);

    const left = args[0];
    const right = toCleanWorkflowUri(left);
    commands.executeCommand("vscode.diff", left, right);
  }
}
