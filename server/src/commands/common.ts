import { ServerContext } from "../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../server";

export abstract class CustomCommand extends ServerContext {
  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.listenToRequests();
  }

  /**
   * This method should call `this.connection.onRequest` to register
   * the proper callback for this command request.
   */
  protected abstract listenToRequests(): void;
}
