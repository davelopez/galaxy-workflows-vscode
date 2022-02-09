import { commands, Disposable } from "vscode";
import { LanguageClient } from "vscode-languageclient/browser";

export namespace CommandIds {
  export const PREVIEW_CLEAN_WORKFLOW = getExtensionCommand("previewCleanWorkflow");
  export const COMPARE_CLEAN_WORKFLOWS = getExtensionCommand("compareCleanWorkflows");
}

function getExtensionCommand(command: string) {
  return `galaxy-workflows.${command}`;
}

export abstract class CommandContext {
  protected client: LanguageClient;

  constructor(client: LanguageClient) {
    this.client = client;
  }
}

/**
 * Represents a custom command that can be invoked by the extension.
 * Extend this class to implement new commands declared in package.json
 */
export abstract class CustomCommand extends CommandContext {
  abstract readonly identifier: string;
  constructor(client: LanguageClient) {
    super(client);
  }

  /**
   * Registers the command to be used by the extension and returns
   * the Disposable to be disposed when the extensions deactivates.
   */
  register(): Disposable {
    return commands.registerCommand(this.identifier, (...args) => this.execute(args));
  }

  /**
   * Executes the command with the given arguments.
   * @param args The arguments passed when invoking the command
   */
  abstract execute(args: any[]): Promise<void>;
}
