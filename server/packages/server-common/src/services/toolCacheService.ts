import {
  DocumentContext,
  GalaxyWorkflowLanguageServer,
  LSNotificationIdentifiers,
  LSRequestIdentifiers,
  PopulateToolCacheParams,
  ToolRef,
  WorkflowDocument,
} from "../languageTypes";
import { ServiceBase } from ".";

// ---------------------------------------------------------------------------
// Helper: extract all tool refs from a single document
// ---------------------------------------------------------------------------

export function extractToolRefsFromDocument(doc: DocumentContext): ToolRef[] {
  if (!(doc instanceof WorkflowDocument)) return [];
  const workflowDoc = doc as WorkflowDocument;
  const root = workflowDoc.nodeManager.root;
  if (!root || root.type !== "object") return [];

  const stepsProp = root.properties.find((p) => p.keyNode.value === "steps");
  if (!stepsProp?.valueNode) return [];

  const stepsValue = stepsProp.valueNode;
  const stepNodes =
    stepsValue.type === "object"
      ? stepsValue.properties.map((p) => p.valueNode).filter(Boolean)
      : stepsValue.type === "array"
        ? stepsValue.items
        : [];

  const seen = new Set<string>();
  const tools: ToolRef[] = [];
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
  return tools;
}

function toolRefKey(ref: ToolRef): string {
  return `${ref.toolId}@${ref.toolVersion ?? ""}`;
}

// ---------------------------------------------------------------------------
// ToolCacheService
// ---------------------------------------------------------------------------

/**
 * Service exposing tool-cache LSP requests:
 * - GET_WORKFLOW_TOOL_IDS: extract all tool refs from open workflow documents
 * - POPULATE_TOOL_CACHE: populate cache for a list of tool refs
 * - GET_TOOL_CACHE_STATUS: return current cache size
 *
 * When the server has `autoResolutionEnabled`, also proactively resolves
 * uncached tools whenever a document is opened via `scheduleResolution()`.
 */
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
  public scheduleResolution(doc: DocumentContext): void {
    if (!this.server.autoResolutionEnabled) return;

    const uncached = extractToolRefsFromDocument(doc).filter(
      (ref) => !this.server.toolRegistryService.hasCached(ref.toolId, ref.toolVersion)
    );
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
