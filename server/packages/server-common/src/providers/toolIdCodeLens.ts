import type { CodeLens, Command, DocumentContext, ToolRegistryService } from "../languageTypes";
import { extractStepSummariesFromDocument } from "../services/toolCacheService";
import {
  OPEN_IN_TOOLSHED_ACTION,
  RETRY_ACTION,
  RUN_POPULATE_TOOL_CACHE_ACTION,
  ToolState,
  toolStateIconMarkup,
} from "../../../../../shared/src/toolStatePresentation";
import { parseToolShedRepoUrl } from "./hover/toolShedUrl";

const CMD_OPEN_IN_TOOLSHED = "galaxy-workflows.openToolInToolShed";
const CMD_POPULATE_CACHE = "galaxy-workflows.populateToolCache";
const CMD_POPULATE_FOR_TOOL = "galaxy-workflows.populateToolCacheForTool";

function headline(state: ToolState, name: string, version?: string): string {
  const suffix = version ? ` ${version}` : "";
  return `${toolStateIconMarkup(state)} ${name}${suffix}`;
}

/**
 * Build CodeLenses for every step's `tool_id` line. One lens per tool step:
 * - cached toolshed tool → "Open in ToolShed" (clickable link)
 * - cached built-in tool → status-only lens (no command)
 * - uncached → "Run Populate Tool Cache" (batch)
 * - resolution failed → "Resolution failed — retry" (per-tool retry)
 */
export async function buildToolIdCodeLenses(doc: DocumentContext, registry: ToolRegistryService): Promise<CodeLens[]> {
  const summaries = extractStepSummariesFromDocument(doc);
  if (summaries.length === 0) return [];
  const hasAnyTool = summaries.some((s) => s.toolId && s.toolIdRange);
  if (!hasAnyTool) return [];

  const lenses: CodeLens[] = [];
  for (const summary of summaries) {
    if (!summary.toolId || !summary.toolIdRange) continue;
    const { toolId, toolVersion, toolIdRange } = summary;

    if (registry.hasResolutionFailed(toolId, toolVersion)) {
      const title = `${headline("failed", toolId, toolVersion)} · ${RETRY_ACTION}`;
      const command: Command = {
        title,
        command: CMD_POPULATE_FOR_TOOL,
        arguments: [{ toolId, toolVersion }],
      };
      lenses.push({ range: toolIdRange, command });
      continue;
    }

    const cached = await registry.hasCached(toolId, toolVersion);
    if (!cached) {
      const title = `${headline("uncached", toolId, toolVersion)} · ${RUN_POPULATE_TOOL_CACHE_ACTION}`;
      const command: Command = { title, command: CMD_POPULATE_CACHE };
      lenses.push({ range: toolIdRange, command });
      continue;
    }

    const info = await registry.getToolInfo(toolId, toolVersion);
    const displayName = info?.name ?? toolId;
    const displayVersion = info?.version ?? toolVersion;
    const toolshedUrl = parseToolShedRepoUrl(toolId);
    if (toolshedUrl) {
      const title = `${headline("cached", displayName, displayVersion)} · ${OPEN_IN_TOOLSHED_ACTION}`;
      const command: Command = {
        title,
        command: CMD_OPEN_IN_TOOLSHED,
        arguments: [{ toolId, toolVersion, toolshedUrl }],
      };
      lenses.push({ range: toolIdRange, command });
    } else {
      // Built-in tool — no ToolShed repo to link to. Emit a command-less lens
      // (VS Code renders the title as plain, non-clickable text) so the cache
      // state icon + name/version still appear inline.
      const command: Command = {
        title: headline("cached", displayName, displayVersion),
        command: "",
      };
      lenses.push({ range: toolIdRange, command });
    }
  }
  return lenses;
}
