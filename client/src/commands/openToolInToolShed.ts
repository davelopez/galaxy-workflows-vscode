import { BaseLanguageClient } from "vscode-languageclient";
import { CustomCommand, getCommandFullIdentifier } from ".";
import { openEntryInToolShed } from "../providers/workflowToolsTreeProvider";
import { WorkflowToolEntry } from "../languageTypes";

export class OpenToolInToolShedCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("openToolInToolShed");
  readonly identifier: string = OpenToolInToolShedCommand.id;

  constructor(client: BaseLanguageClient) {
    super(client);
  }

  async execute(args: unknown[]): Promise<void> {
    const entry = resolveEntry(args[0]);
    if (entry?.toolshedUrl) openEntryInToolShed(entry);
  }
}

function resolveEntry(arg: unknown): WorkflowToolEntry | undefined {
  if (!arg || typeof arg !== "object") return undefined;
  const maybeWrapped = arg as { entry?: WorkflowToolEntry };
  if (maybeWrapped.entry) return maybeWrapped.entry;
  return arg as WorkflowToolEntry;
}
