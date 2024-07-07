import { injectable } from "inversify";
import { ToolInfo, ToolshedService } from "../languageTypes";

const TOOLSHED_URL = "https://toolshed.g2.bx.psu.edu";

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
  private readonly limit = 5;
  public async searchTools(query: string): Promise<ToolInfo[]> {
    try {
      const response = await fetch(`${toolshedUrl}/api/tools?q=${query}&page_size=${this.limit}`);
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
          url: `${TOOLSHED_URL}/repos/${tool.repo_owner_username}/${tool.repo_name}/${tool.id}`,
        };
      });
    } catch (error) {
      console.error("Error fetching tools from the toolshed", error);
      return [];
    }
  }
}
