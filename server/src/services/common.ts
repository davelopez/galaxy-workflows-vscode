import { ServerContext } from "../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../server";

export abstract class ServiceBase extends ServerContext {
  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.listenToRequests();
  }

  /**
   * This method should call `this.connection.onRequest` to register
   * the proper callback for this service request.
   */
  protected abstract listenToRequests(): void;
}
