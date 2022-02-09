import { commands } from "vscode";
import { toCleanWorkflowUri } from "../providers/cleanWorkflowDocumentProvider";
import { debugPrintCommandArgs } from "../utils";
import { CustomCommand, getCommandFullIdentifier } from "./common";

export class CompareCleanWithWorkflowsCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("compareCleanWith");
  readonly identifier: string = CompareCleanWithWorkflowsCommand.id;

  /** TODO: Implement the real command, this is just a placeholder */
  async execute(args: any[]): Promise<void> {
    debugPrintCommandArgs(this.identifier, args, this.client.outputChannel);

    const left = args[1];
    const right = toCleanWorkflowUri(left);
    commands.executeCommand("vscode.diff", left, right);
  }
}
