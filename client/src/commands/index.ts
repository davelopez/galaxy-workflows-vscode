import { commands, Disposable, Uri } from "vscode";
import { CommonLanguageClient } from "vscode-languageclient";

/**
 * Gets the fully-qualified identifier of the command by prefixing
 * the extension name to the identifier.
 * @param command Command unique ID
 * @returns Fully-qualified identifier of the command
 */
export function getCommandFullIdentifier(command: string): string {
  return `galaxy-workflows.${command}`;
}

/**
 * Context information or services that may be useful for the
 * command.
 */
export abstract class CommandContext {
  /** Allows to access language features. */
  protected client: CommonLanguageClient;

  constructor(client: CommonLanguageClient) {
    this.client = client;
  }
}

/**
 * Represents a custom command that can be invoked by the extension.
 * Extend this class to implement new commands declared in package.json
 */
export abstract class CustomCommand extends CommandContext {
  abstract readonly identifier: string;
  constructor(client: CommonLanguageClient) {
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
  abstract execute(args: unknown[]): Promise<void>;
}

/**
 * Contains the URI and git ref of a particular workflow
 * document revision.
 */
export class ComparableWorkflow {
  uri: Uri;
  ref: string;

  public static buildFromArgs(args: unknown[]): ComparableWorkflow | undefined {
    if (args.length >= 2) {
      if (Object.prototype.hasOwnProperty.call(args[0], "ref")) {
        // Comes from source control timeline
        return { uri: args[1] as Uri, ref: args[0]["ref"] };
      } else if (Object.prototype.hasOwnProperty.call(args[0], "scheme")) {
        // Comes from file explorer
        return { uri: args[0] as Uri, ref: undefined };
      }
    }
    return undefined;
  }
}

/**
 * Interface for retrieving a previously selected workflow document
 * revision.
 */
export interface ComparableWorkflowProvider {
  getSelectedForCompare(): ComparableWorkflow | undefined;
}
