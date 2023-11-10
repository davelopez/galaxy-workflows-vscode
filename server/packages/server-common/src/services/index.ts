import { GalaxyWorkflowLanguageServer } from "../languageTypes";

export abstract class ServiceBase {
  constructor(public server: GalaxyWorkflowLanguageServer) {
    this.listenToRequests();
  }

  /**
   * This method should call `this.connection.onRequest` to register
   * the proper callback for this service request.
   */
  protected abstract listenToRequests(): void;
}
