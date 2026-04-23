import { buildStep } from "@galaxy-tool-util/schema";
import { ServiceBase } from ".";
import {
  GalaxyWorkflowLanguageServer,
  GetStepSkeletonParams,
  GetStepSkeletonResult,
  LSRequestIdentifiers,
  SearchToolsParams,
  SearchToolsResult,
  ToolSearchHit,
} from "../languageTypes";

const DEFAULT_MAX_RESULTS = 50;

export class ToolSearchLspService extends ServiceBase {
  public static register(server: GalaxyWorkflowLanguageServer): ToolSearchLspService {
    return new ToolSearchLspService(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
  }

  protected listenToRequests(): void {
    this.server.connection.onRequest(LSRequestIdentifiers.SEARCH_TOOLS, (params: SearchToolsParams) =>
      this.onSearchTools(params)
    );
    this.server.connection.onRequest(
      LSRequestIdentifiers.GET_STEP_SKELETON,
      (params: GetStepSkeletonParams) => this.onGetStepSkeleton(params)
    );
  }

  private async onSearchTools(params: SearchToolsParams): Promise<SearchToolsResult> {
    const search = this.server.toolRegistryService.getSearchService();
    if (!search) return { hits: [], truncated: false };
    const maxResults = params.maxResults ?? DEFAULT_MAX_RESULTS;
    const hits = await search.searchTools(params.query, {
      pageSize: params.pageSize,
      maxResults: maxResults + 1,
    });
    const truncated = hits.length > maxResults;
    const trimmed = truncated ? hits.slice(0, maxResults) : hits;
    const wireHits: ToolSearchHit[] = trimmed.map((h) => ({
      toolshedUrl: h.source.url,
      toolId: h.toolId,
      toolName: h.toolName,
      toolDescription: h.toolDescription,
      repoName: h.repoName,
      repoOwnerUsername: h.repoOwnerUsername,
      score: h.score,
      version: h.version,
      changesetRevision: h.changesetRevision,
      trsToolId: h.trsToolId,
      fullToolId: h.fullToolId,
    }));
    return { hits: wireHits, truncated };
  }

  private async onGetStepSkeleton(params: GetStepSkeletonParams): Promise<GetStepSkeletonResult> {
    const registry = this.server.toolRegistryService;
    const search = registry.getSearchService();
    let version: string | null = params.version ?? null;
    if (!version && search) {
      try {
        version = await search.getLatestVersionForToolId(params.toolshedUrl, params.trsToolId);
      } catch (e) {
        return { step: null, error: `Failed to resolve latest version: ${String(e)}` };
      }
    }
    if (!version) return { step: null, error: "No version available for tool." };

    // Ensure the tool is cached, then read its ParsedTool from the registry.
    const fullToolId = buildFullToolId(params.toolshedUrl, params.trsToolId, version);
    await registry.populateCache([{ toolId: fullToolId, toolVersion: version }]);
    const tool = await registry.getToolInfo(fullToolId, version);
    if (!tool) return { step: null, error: `Tool ${fullToolId}@${version} could not be resolved.` };

    try {
      const step = buildStep({
        tool,
        format: params.format,
        stepIndex: params.stepIndex,
        label: params.label,
      });
      return { step };
    } catch (e) {
      return { step: null, error: `Failed to build step skeleton: ${String(e)}` };
    }
  }
}

/** Reconstruct `<host>/repos/<owner>/<repo>/<toolId>/<version>` from a TRS id. */
function buildFullToolId(toolshedUrl: string, trsToolId: string, version: string): string {
  const host = toolshedUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const [owner, repo, toolId] = trsToolId.split("~");
  return `${host}/repos/${owner}/${repo}/${toolId}/${version}`;
}
