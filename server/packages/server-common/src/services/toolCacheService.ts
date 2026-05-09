import type { Range } from "vscode-languageserver-types";
import type { ObjectASTNode } from "../ast/types";
import {
  DocumentContext,
  GalaxyWorkflowLanguageServer,
  GetWorkflowToolsParams,
  GetWorkflowToolsResult,
  LSNotificationIdentifiers,
  LSRequestIdentifiers,
  PopulateToolCacheForToolParams,
  PopulateToolCacheParams,
  PopulateToolCacheResult,
  ToolRef,
  WorkflowDocument,
  WorkflowToolEntry,
} from "../languageTypes";
import { parseToolShedRepoUrl } from "../providers/hover/toolShedUrl";
import { ServiceBase } from ".";

interface StepNode {
  stepId: string;
  stepNode: ObjectASTNode;
}

/**
 * Enumerate step object nodes in document order, handling both the native
 * dict-of-steps layout (`.ga`) and the format2 array-of-steps layout
 * (`.gxwf.yml`).
 */
function getStepNodes(doc: DocumentContext): StepNode[] {
  if (!(doc instanceof WorkflowDocument)) return [];
  const root = doc.nodeManager.root;
  if (!root || root.type !== "object") return [];
  const stepsProp = root.properties.find((p) => p.keyNode.value === "steps");
  const stepsValue = stepsProp?.valueNode;
  if (!stepsValue) return [];

  const steps: StepNode[] = [];
  if (stepsValue.type === "object") {
    for (const prop of stepsValue.properties) {
      if (prop.valueNode?.type === "object") {
        steps.push({ stepId: String(prop.keyNode.value), stepNode: prop.valueNode });
      }
    }
  } else if (stepsValue.type === "array") {
    stepsValue.items.forEach((item, idx) => {
      if (item?.type === "object") {
        steps.push({ stepId: String(idx), stepNode: item });
      }
    });
  }
  return steps;
}

function stringProp(node: ObjectASTNode, key: string): string | undefined {
  return node.properties.find((p) => p.keyNode.value === key)?.valueNode?.value?.toString();
}

export function extractToolRefsFromDocument(doc: DocumentContext): ToolRef[] {
  const seen = new Set<string>();
  const tools: ToolRef[] = [];
  for (const { stepNode } of getStepNodes(doc)) {
    const toolId = stringProp(stepNode, "tool_id");
    if (!toolId) continue;
    const toolVersion = stringProp(stepNode, "tool_version");
    const key = `${toolId}@${toolVersion ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tools.push({ toolId, toolVersion });
  }
  return tools;
}

function toolRefKey(ref: ToolRef): string {
  return `${ref.toolId}@${ref.toolVersion ?? ""}`;
}

interface StepSummary {
  stepId: string;
  label?: string;
  toolId?: string;
  toolVersion?: string;
  toolIdRange?: Range;
}

export function extractStepSummariesFromDocument(doc: DocumentContext): StepSummary[] {
  if (!(doc instanceof WorkflowDocument)) return [];
  const nm = doc.nodeManager;
  const summaries: StepSummary[] = [];
  for (const { stepId, stepNode } of getStepNodes(doc)) {
    const toolIdProp = stepNode.properties.find((p) => p.keyNode.value === "tool_id");
    const toolIdRange = toolIdProp?.valueNode ? nm.getNodeRange(toolIdProp.valueNode) : undefined;
    summaries.push({
      stepId,
      label: stringProp(stepNode, "label") ?? stringProp(stepNode, "annotation") ?? stringProp(stepNode, "doc"),
      toolId: toolIdProp?.valueNode?.value?.toString(),
      toolVersion: stringProp(stepNode, "tool_version"),
      toolIdRange,
    });
  }
  return summaries;
}

export class ToolCacheService extends ServiceBase {
  private _pending = new Map<string, { toolRef: ToolRef; documentUris: Set<string> }>();
  private _inFlight = new Set<string>();
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  public static register(server: GalaxyWorkflowLanguageServer): ToolCacheService {
    return new ToolCacheService(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
  }

  protected listenToRequests(): void {
    this.server.connection.onRequest(LSRequestIdentifiers.GET_WORKFLOW_TOOL_IDS, () => this.onGetWorkflowToolIds());

    this.server.connection.onRequest(LSRequestIdentifiers.POPULATE_TOOL_CACHE, (params: PopulateToolCacheParams) =>
      this.server.toolRegistryService.populateCache(params.tools)
    );

    this.server.connection.onRequest(
      LSRequestIdentifiers.POPULATE_TOOL_CACHE_FOR_TOOL,
      (params: PopulateToolCacheForToolParams) => this.onPopulateToolCacheForTool(params)
    );

    this.server.connection.onRequest(LSRequestIdentifiers.GET_TOOL_CACHE_STATUS, async () => ({
      cacheSize: await this.server.toolRegistryService.getCacheSize(),
    }));

    this.server.connection.onRequest(LSRequestIdentifiers.GET_WORKFLOW_TOOLS, (params: GetWorkflowToolsParams) =>
      this.onGetWorkflowTools(params)
    );
  }

  private async onPopulateToolCacheForTool(params: PopulateToolCacheForToolParams): Promise<PopulateToolCacheResult> {
    const { toolId, toolVersion } = params;
    return this.server.toolRegistryService.populateCache([{ toolId, toolVersion }]);
  }

  private async onGetWorkflowTools(params: GetWorkflowToolsParams): Promise<GetWorkflowToolsResult> {
    const doc = this.server.documentsCache.get(params.uri);
    if (!doc) return { tools: [] };
    const registry = this.server.toolRegistryService;
    const summaries = extractStepSummariesFromDocument(doc);

    const tools: WorkflowToolEntry[] = [];
    for (const summary of summaries) {
      if (!summary.toolId || !summary.toolIdRange) continue;
      const cached = await registry.hasCached(summary.toolId, summary.toolVersion);
      const resolutionFailed = registry.hasResolutionFailed(summary.toolId, summary.toolVersion);
      let name: string | undefined;
      let description: string | null | undefined;
      if (cached) {
        const info = await registry.getToolInfo(summary.toolId, summary.toolVersion);
        if (info) {
          name = info.name;
          description = info.description;
        }
      }
      const toolshedUrl = parseToolShedRepoUrl(summary.toolId) ?? undefined;
      tools.push({
        stepId: summary.stepId,
        stepLabel: summary.label,
        toolId: summary.toolId,
        toolVersion: summary.toolVersion,
        cached,
        resolutionFailed,
        name,
        description,
        toolshedUrl,
        range: summary.toolIdRange,
      });
    }
    return { tools };
  }

  private onGetWorkflowToolIds(): { tools: ToolRef[] } {
    const seen = new Set<string>();
    const tools: ToolRef[] = [];
    for (const doc of this.server.documentsCache.all()) {
      for (const ref of extractToolRefsFromDocument(doc)) {
        const key = toolRefKey(ref);
        if (!seen.has(key)) {
          seen.add(key);
          tools.push(ref);
        }
      }
    }
    return { tools };
  }

  // -------------------------------------------------------------------------
  // Auto-resolution
  // -------------------------------------------------------------------------

  /** Schedule auto-resolution for all uncached tools in `doc`. */
  public async scheduleResolution(doc: DocumentContext): Promise<void> {
    if (!this.server.autoResolutionEnabled) return;

    const refs = extractToolRefsFromDocument(doc);
    const cachedFlags = await Promise.all(
      refs.map((ref) => this.server.toolRegistryService.hasCached(ref.toolId, ref.toolVersion))
    );
    const uncached = refs.filter((_, i) => !cachedFlags[i]);
    if (uncached.length === 0) return;

    for (const ref of uncached) {
      const key = toolRefKey(ref);
      const entry = this._pending.get(key) ?? { toolRef: ref, documentUris: new Set<string>() };
      entry.documentUris.add(doc.textDocument.uri);
      this._pending.set(key, entry);
    }

    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => void this._flushResolution(), 300);
  }

  private async _flushResolution(): Promise<void> {
    this._debounceTimer = null;

    // Collect tools not already in-flight.
    // _pending is cleared immediately so any scheduleResolution() calls that
    // arrive while this fetch is in-flight start a fresh pending set rather
    // than racing with the current batch.
    const toFetch: Array<{ toolRef: ToolRef; documentUris: Set<string> }> = [];
    for (const [key, entry] of this._pending) {
      if (!this._inFlight.has(key)) {
        toFetch.push(entry);
        this._inFlight.add(key);
      }
    }
    this._pending.clear();

    if (toFetch.length === 0) return;

    // Build a key→entry map for fast failure lookup by both toolId + toolVersion.
    const byKey = new Map<string, { toolRef: ToolRef; documentUris: Set<string> }>();
    for (const entry of toFetch) byKey.set(toolRefKey(entry.toolRef), entry);

    let result: { fetched: number; alreadyCached: number; failed: Array<{ toolId: string; error: string }> };
    try {
      result = await this.server.toolRegistryService.populateCache(toFetch.map((e) => e.toolRef));
    } catch {
      // If populateCache itself throws, release all in-flight locks so the
      // tools can be retried on the next document open.
      for (const entry of toFetch) this._inFlight.delete(toolRefKey(entry.toolRef));
      return;
    }

    // Release in-flight locks and collect docs to re-validate.
    const docsToRevalidate = new Set<string>();
    for (const entry of toFetch) {
      this._inFlight.delete(toolRefKey(entry.toolRef));
      for (const uri of entry.documentUris) docsToRevalidate.add(uri);
    }

    // Mark failed tools so the diagnostic can update its message/severity.
    // Match on both toolId and toolVersion to avoid ambiguity when the same
    // tool appears with different versions in the same batch.
    for (const { toolId } of result.failed) {
      // populateCache returns toolId only; find the matching entry by toolId.
      // If multiple versions were batched (unusual), mark all matching versions
      // failed since we cannot tell which version caused the failure.
      for (const [key, entry] of byKey) {
        if (entry.toolRef.toolId === toolId) {
          this.server.toolRegistryService.markResolutionFailed(toolId, entry.toolRef.toolVersion);
          byKey.delete(key); // consume so each entry is marked at most once per failure
        }
      }
    }

    // Re-validate all affected documents.
    for (const uri of docsToRevalidate) {
      this.server.revalidateDocument(uri);
    }

    // Notify the client of any failures.
    if (result.failed.length > 0) {
      this.server.connection.sendNotification(LSNotificationIdentifiers.TOOL_RESOLUTION_FAILED, {
        failures: result.failed,
      });
    }
  }
}
