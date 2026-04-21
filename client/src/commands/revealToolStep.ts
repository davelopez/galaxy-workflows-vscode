import { BaseLanguageClient } from "vscode-languageclient";
import { CustomCommand, getCommandFullIdentifier } from ".";
import { revealEntryInEditor } from "../providers/workflowToolsTreeProvider";
import { WorkflowToolEntry } from "../languageTypes";

export class RevealToolStepCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("revealToolStep");
  readonly identifier: string = RevealToolStepCommand.id;

  constructor(client: BaseLanguageClient) {
    super(client);
  }

  async execute(args: unknown[]): Promise<void> {
    const entry = resolveEntry(args[0]);
    if (entry?.range) revealEntryInEditor(entry);
  }
}

function resolveEntry(arg: unknown): WorkflowToolEntry | undefined {
  if (!arg || typeof arg !== "object") return undefined;
  const maybeWrapped = arg as { entry?: WorkflowToolEntry };
  if (maybeWrapped.entry) return maybeWrapped.entry;
  return arg as WorkflowToolEntry;
}
