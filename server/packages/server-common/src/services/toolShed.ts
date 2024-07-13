import { inject, injectable } from "inversify";
import { ConfigService } from "../configService";
import { TYPES, ToolInfo, ToolshedService } from "../languageTypes";
import { getResponseErrorMessage } from "../utils";

interface ToolShedResponse {
  total_results: string;
  page: string;
  page_size: string;
  hits: {
    tool: {
      id: string;
      repo_owner_username: string;
      repo_name: string;
      name: string;
      description: string;
    };
    matched_terms: {
      name?: string;
      description?: string;
      help?: string;
    };
    score: number;
  }[];
  hostname: string;
}

interface BuildRequestResult {
  request: Request;
  baseUrl: URL;
}

@injectable()
export class ToolshedServiceImpl implements ToolshedService {
  constructor(@inject(TYPES.ConfigService) public readonly configService: ConfigService) {}

  public async searchToolsById(toolId: string, limit = 5): Promise<ToolInfo[]> {
    const { request, baseUrl } = await this.buildToolSearchRequest(toolId, limit);
    const toolshedUrl = baseUrl.origin;
    try {
      const response = await fetch(request);

      if (!response.ok) {
        const error = await getResponseErrorMessage(response);
        console.error(`Error fetching tools from the toolshed at '${toolshedUrl}'`, error);
        return [];
      }

      const json = await response.json();
      const toolshedResponse = json as ToolShedResponse;
      const hits = toolshedResponse.hits;

      return hits.map((hit) => {
        const tool = hit.tool;
        return {
          id: tool.id,
          name: tool.name,
          description: tool.description,
          owner: tool.repo_owner_username,
          repository: tool.repo_name,
          url: `${toolshedUrl}/repos/${tool.repo_owner_username}/${tool.repo_name}/${tool.id}`,
        };
      });
    } catch (error) {
      console.error(`Error fetching tools from the toolshed at '${toolshedUrl}'`, error);
      return [];
    }
  }

  private async buildToolSearchRequest(toolId: string, limit: number): Promise<BuildRequestResult> {
    const toolshedUrl = await this.validateToolshedUrl();
    const toolsApiUrl = `${toolshedUrl}/api/tools`;
    const queryParams = new URLSearchParams({
      q: `id:${toolId}`,
      page_size: limit.toString(),
    });

    return {
      request: new Request(`${toolsApiUrl}?${queryParams}`),
      baseUrl: toolshedUrl,
    };
  }

  private async validateToolshedUrl(): Promise<URL> {
    const settings = await this.configService.getDocumentSettings();
    let validatedUrl: URL;
    try {
      validatedUrl = new URL(settings.toolshed.url);
    } catch {
      throw new Error(
        `Invalid Toolshed URL: '${settings.toolshed.url}'. Please provide a valid URL for the setting 'galaxyWorkflows.toolshed.url'.`
      );
    }
    return validatedUrl;
  }
}
