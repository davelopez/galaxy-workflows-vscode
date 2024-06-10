import { Disposable } from "vscode-languageserver";
import { GalaxyWorkflowLanguageServer } from "../languageTypes";

/**
 * Base class for all server event handlers.
 *
 * Used to register event handlers for the language server.
 */
export abstract class ServerEventHandler {
  private disposables: Disposable[] = [];
  constructor(public server: GalaxyWorkflowLanguageServer) {}

  protected register(disposable: Disposable): void {
    this.disposables.push(disposable);
  }

  public dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
  }
}
