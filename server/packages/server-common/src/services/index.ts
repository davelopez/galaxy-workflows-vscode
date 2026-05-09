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

  /** Detect workflow language ID from raw content (JSON object → "galaxyworkflow", otherwise → "gxformat2"). */
  protected detectLanguageId(contents: string): string {
    try {
      const parsed = JSON.parse(contents);
      if (parsed !== null && typeof parsed === "object") return "galaxyworkflow";
    } catch {
      // not JSON
    }
    return "gxformat2";
  }
}
