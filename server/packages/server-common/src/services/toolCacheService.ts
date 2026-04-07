import {
  GalaxyWorkflowLanguageServer,
  LSRequestIdentifiers,
  PopulateToolCacheParams,
  ToolRef,
  WorkflowDocument,
} from "../languageTypes";
import { ServiceBase } from ".";

/**
 * Service exposing tool-cache LSP requests:
 * - GET_WORKFLOW_TOOL_IDS: extract all tool refs from open workflow documents
 * - POPULATE_TOOL_CACHE: populate cache for a list of tool refs
 * - GET_TOOL_CACHE_STATUS: return current cache size
 */
export class ToolCacheService extends ServiceBase {
  public static register(server: GalaxyWorkflowLanguageServer): ToolCacheService {
    return new ToolCacheService(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
  }

  protected listenToRequests(): void {
    this.server.connection.onRequest(LSRequestIdentifiers.GET_WORKFLOW_TOOL_IDS, () =>
      this.onGetWorkflowToolIds()
    );

    this.server.connection.onRequest(
      LSRequestIdentifiers.POPULATE_TOOL_CACHE,
      (params: PopulateToolCacheParams) => this.server.toolRegistryService.populateCache(params.tools)
    );

    this.server.connection.onRequest(LSRequestIdentifiers.GET_TOOL_CACHE_STATUS, () => ({
      cacheSize: this.server.toolRegistryService.cacheSize,
    }));
  }

  private onGetWorkflowToolIds(): { tools: ToolRef[] } {
    const seen = new Set<string>();
    const tools: ToolRef[] = [];

    for (const doc of this.server.documentsCache.all()) {
      if (!(doc instanceof WorkflowDocument)) continue;
      const workflowDoc = doc as WorkflowDocument;
      const root = workflowDoc.nodeManager.root;
      if (!root || root.type !== "object") continue;

      const stepsProp = root.properties.find((p) => p.keyNode.value === "steps");
      if (!stepsProp?.valueNode) continue;

      const stepsValue = stepsProp.valueNode;
      const stepNodes =
        stepsValue.type === "object"
          ? stepsValue.properties.map((p) => p.valueNode).filter(Boolean)
          : stepsValue.type === "array"
            ? stepsValue.items
            : [];

      for (const step of stepNodes) {
        if (!step || step.type !== "object") continue;
        const toolIdProp = step.properties.find((p) => p.keyNode.value === "tool_id");
        const toolVerProp = step.properties.find((p) => p.keyNode.value === "tool_version");
        const toolId = toolIdProp?.valueNode?.value?.toString();
        if (!toolId) continue;
        const toolVersion = toolVerProp?.valueNode?.value?.toString();
        const key = `${toolId}@${toolVersion ?? ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          tools.push({ toolId, toolVersion });
        }
      }
    }

    return { tools };
  }
}
