import { ServiceBase } from ".";
import {
  GalaxyWorkflowLanguageServer,
  LSRequestIdentifiers,
  RenderWorkflowDiagramParams,
  RenderWorkflowDiagramResult,
} from "../languageTypes";

/**
 * Service for handling workflow diagram rendering requests. Dispatches to the
 * appropriate language service's renderDiagram() based on detected content type.
 * Mirrors ConvertWorkflowService — errors are returned as a typed result so the
 * client can surface them to the webview.
 */
export class RenderDiagramService extends ServiceBase {
  public static register(server: GalaxyWorkflowLanguageServer): RenderDiagramService {
    return new RenderDiagramService(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
  }

  protected listenToRequests(): void {
    this.server.connection.onRequest(
      LSRequestIdentifiers.RENDER_WORKFLOW_DIAGRAM,
      (params: RenderWorkflowDiagramParams) => this.onRenderRequest(params)
    );
  }

  private async onRenderRequest(params: RenderWorkflowDiagramParams): Promise<RenderWorkflowDiagramResult> {
    try {
      const languageId = this.detectLanguageId(params.contents);
      const languageService = this.server.getLanguageServiceById(languageId);
      const contents = await languageService.renderDiagram(params.contents, params.format, params.options);
      return { contents };
    } catch (error) {
      return { contents: "", error: String(error) };
    }
  }
}
