import { ServiceBase } from ".";
import {
  ConvertWorkflowContentsParams,
  ConvertWorkflowContentsResult,
  GalaxyWorkflowLanguageServer,
  LSRequestIdentifiers,
} from "../languageTypes";

/**
 * Service for handling workflow conversion requests (Format2 ↔ Native).
 * Delegates to each language service's convertWorkflowText() which in turn
 * delegates to toFormat2Stateful()/toNativeStateful() from @galaxy-tool-util/schema.
 */
export class ConvertWorkflowService extends ServiceBase {
  public static register(server: GalaxyWorkflowLanguageServer): ConvertWorkflowService {
    return new ConvertWorkflowService(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
  }

  protected listenToRequests(): void {
    this.server.connection.onRequest(
      LSRequestIdentifiers.CONVERT_WORKFLOW_CONTENTS,
      (params: ConvertWorkflowContentsParams) => this.onConvertWorkflowContentsRequest(params)
    );
  }

  private async onConvertWorkflowContentsRequest(
    params: ConvertWorkflowContentsParams
  ): Promise<ConvertWorkflowContentsResult> {
    // Unlike CleanWorkflowService which lets errors propagate to the LSP client,
    // conversion errors are returned as a typed result so the client can surface
    // them to the user via showErrorMessage() rather than a silent console error.
    try {
      const languageId = this.detectLanguageId(params.contents);
      const languageService = this.server.getLanguageServiceById(languageId);
      const contents = await languageService.convertWorkflowText(params.contents, params.targetFormat);
      return { contents };
    } catch (error) {
      return { contents: "", error: String(error) };
    }
  }

  /** Detect workflow language ID from raw content (JSON → native, otherwise → format2). */
  private detectLanguageId(contents: string): string {
    try {
      const parsed = JSON.parse(contents);
      if (parsed !== null && typeof parsed === "object") return "galaxyworkflow";
    } catch {
      // not JSON
    }
    return "gxformat2";
  }
}
