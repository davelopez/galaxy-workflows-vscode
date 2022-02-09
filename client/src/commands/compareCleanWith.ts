import { commands } from "vscode";
import { toCleanWorkflowUri } from "../providers/cleanWorkflowDocumentProvider";
import { debugPrintCommandArgs } from "../utils";
import { CommandIds, CustomCommand } from "./common";

export class CompareCleanWithWorkflowsCommand extends CustomCommand {
  readonly identifier: string = CommandIds.COMPARE_CLEAN_WITH;

  async execute(args: any[]): Promise<void> {
    debugPrintCommandArgs(this.identifier, args, this.client.outputChannel);

    const left = args[1];
    const right = toCleanWorkflowUri(left);
    commands.executeCommand("vscode.diff", left, right);
  }
}
