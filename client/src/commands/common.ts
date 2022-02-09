import { commands, Disposable } from "vscode";
import { LanguageClient } from "vscode-languageclient/browser";

/**
 * Gets the fully-qualified identifier of the command by prefixing
 * the extension name to the identifier.
 * @param command Command unique ID
 * @returns Fully-qualified identifier of the command
 */
export function getCommandFullIdentifier(command: string) {
  return `galaxy-workflows.${command}`;
}

/**
 * Context information or services that may be useful for the
 * command.
 */
export abstract class CommandContext {
  /** Allows to access language features. */
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
