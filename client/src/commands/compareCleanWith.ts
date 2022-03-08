import { commands } from "vscode";
import { CommonLanguageClient } from "vscode-languageclient";
import { toCleanWorkflowUri } from "../providers/cleanWorkflowDocumentProvider";
import { CleanWorkflowProvider } from "../providers/cleanWorkflowProvider";
import { addRefToUri } from "../utils";
import { ComparableWorkflow, ComparableWorkflowProvider, CustomCommand, getCommandFullIdentifier } from "./common";

/**
 * Compares (diff) a previously selected workflow document revision with
 * the target workflow document revision.
 */
export class CompareCleanWithWorkflowsCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("compareCleanWith");
  readonly identifier: string = CompareCleanWithWorkflowsCommand.id;

  constructor(
    client: CommonLanguageClient,
    readonly comparableWorkflowProvider: ComparableWorkflowProvider,
    readonly cleanWorkflowProvider: CleanWorkflowProvider
  ) {
    super(client);
  }

  async execute(args: any[]): Promise<void> {
    const leftComparable = this.comparableWorkflowProvider.getSelectedForCompare();
    const rightComparable: ComparableWorkflow = { uri: args[1], ref: args[0].ref };

    const leftUri = this.buildCleanWorkflowUriWithRef(leftComparable);
    const rightUri = this.buildCleanWorkflowUriWithRef(rightComparable);

    commands.executeCommand("vscode.diff", leftUri, rightUri);
  }

  private buildCleanWorkflowUriWithRef(comparableWorkflow: ComparableWorkflow) {
    const uriWithRef = addRefToUri(comparableWorkflow.uri, comparableWorkflow.ref);
    return toCleanWorkflowUri(uriWithRef);
  }
}
