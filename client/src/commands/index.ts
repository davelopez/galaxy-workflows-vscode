import { commands, Disposable, Uri } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";

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
  protected client: BaseLanguageClient;

  constructor(client: BaseLanguageClient) {
    this.client = client;
  }
}

/**
 * Represents a custom command that can be invoked by the extension.
 * Extend this class to implement new commands declared in package.json
 */
export abstract class CustomCommand extends CommandContext {
  abstract readonly identifier: string;
  constructor(client: BaseLanguageClient) {
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
  ref?: string;

  constructor(uri: Uri, ref?: string) {
    this.uri = uri;
    this.ref = ref;
  }

  // TODO: This is no longer working until a new API is available
  // ref: https://github.com/microsoft/vscode/issues/177319
  // ref: https://github.com/microsoft/vscode/issues/84297
  public static buildFromArgs(args: unknown[]): ComparableWorkflow | undefined {
    if (args.length >= 2) {
      const source = args[2] as string;
      if (source === "git-history") {
        // Comes from source control timeline
        return { uri: args[1] as Uri, ref: args[0] as string };
      }
      if (source === "timeline.localHistory") {
        // Comes from local history
        return { uri: args[1] as Uri };
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
