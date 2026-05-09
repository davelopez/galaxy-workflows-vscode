/**
 * Shared presentation atoms for the three tool-state surfaces (hover, tree,
 * CodeLens). Kept here so wording stays consistent across server and client.
 */

export type ToolState = "cached" | "uncached" | "failed";

/** Codicon name per state. Server embeds as `$(name)`, client wraps in `ThemeIcon`. */
export const TOOL_STATE_ICON_NAME: Record<ToolState, string> = {
  cached: "check",
  uncached: "info",
  failed: "error",
};

export function toolStateIconMarkup(state: ToolState): string {
  return `$(${TOOL_STATE_ICON_NAME[state]})`;
}

export const POPULATE_TOOL_CACHE_COMMAND_NAME = "Populate Tool Cache";
export const OPEN_IN_TOOLSHED_ACTION = "Open in ToolShed";
export const RETRY_ACTION = "Resolution failed — retry";
export const RUN_POPULATE_TOOL_CACHE_ACTION = `Run ${POPULATE_TOOL_CACHE_COMMAND_NAME}`;

export const TOOL_NOT_CACHED_HEADLINE = "Tool not cached";
export const TOOL_RESOLUTION_FAILED_HEADLINE = "Could not resolve tool from ToolShed";
export const TOOL_NOT_CACHED_HINT = `Run the **${POPULATE_TOOL_CACHE_COMMAND_NAME}** command to fetch tool metadata.`;
