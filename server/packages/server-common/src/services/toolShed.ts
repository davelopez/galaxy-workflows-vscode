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

@injectable()
export class ToolshedServiceImpl implements ToolshedService {
  constructor(@inject(TYPES.ConfigService) public readonly configService: ConfigService) {}

  public async searchTools(query: string, limit = 5): Promise<ToolInfo[]> {
    const settings = await this.configService.getDocumentSettings();
    const toolshedUrl = settings.toolshed.url;

    try {
      const whooshQueryById = `id:${query}`;
      const response = await fetch(`${toolshedUrl}/api/tools?q=${whooshQueryById}&page_size=${limit}`);

      if (!response.ok) {
        const error = await getResponseErrorMessage(response);
        console.error(`Error fetching tools from the toolshed at '${toolshedUrl}'`, error);
        return [];
      }

      const json = (await response.json()) as ToolShedResponse;
      const hits = json.hits;

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
}
