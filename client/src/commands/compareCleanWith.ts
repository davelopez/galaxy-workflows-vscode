import { commands, Uri } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { ComparableWorkflow, ComparableWorkflowProvider, CustomCommand, getCommandFullIdentifier } from ".";
import { addRefToUri } from "../common/utils";
import { toCleanWorkflowUri } from "../providers/cleanWorkflowDocumentProvider";
import { CleanWorkflowProvider } from "../providers/cleanWorkflowProvider";

/**
 * Compares (diff) a previously selected workflow document revision with
 * the target workflow document revision.
 */
export class CompareCleanWithWorkflowsCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("compareCleanWith");
  readonly identifier: string = CompareCleanWithWorkflowsCommand.id;

  constructor(
    client: BaseLanguageClient,
    readonly comparableWorkflowProvider: ComparableWorkflowProvider,
    readonly cleanWorkflowProvider: CleanWorkflowProvider
  ) {
    super(client);
  }

  async execute(args: unknown[]): Promise<void> {
    const leftComparable = this.comparableWorkflowProvider.getSelectedForCompare();
    const rightComparable = ComparableWorkflow.buildFromArgs(args);

    if (!leftComparable || !rightComparable) {
      throw new Error("You need to have two workflows selected for comparison");
    }

    const leftUri = this.buildCleanWorkflowUri(leftComparable);
    const rightUri = this.buildCleanWorkflowUri(rightComparable);

    commands.executeCommand("vscode.diff", leftUri, rightUri);
  }

  private buildCleanWorkflowUri(comparableWorkflow: ComparableWorkflow): Uri {
    const uri = comparableWorkflow.ref
      ? addRefToUri(comparableWorkflow.uri, comparableWorkflow.ref)
      : comparableWorkflow.uri;
    return toCleanWorkflowUri(uri);
  }
}
