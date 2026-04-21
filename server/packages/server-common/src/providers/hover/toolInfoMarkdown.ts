import type { ParsedTool } from "@galaxy-tool-util/core";
import { parseToolShedRepoUrl } from "./toolShedUrl";

export interface ToolInfoMarkdownOptions {
  /** Max characters of help text to include. Default 500. */
  helpExcerptChars?: number;
}

const DEFAULT_HELP_CHARS = 500;

/** Derive an `[type:value](link)` row for known xref kinds. */
function renderXref(xref: { type: string; value: string }): string {
  const { type, value } = xref;
  if (type === "bio.tools") {
    return `[bio.tools:${value}](https://bio.tools/${value})`;
  }
  if (type === "bioconductor") {
    return `[bioconductor:${value}](https://bioconductor.org/packages/${value})`;
  }
  return `${type}:${value}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

/**
 * Build a markdown block describing a parsed tool. Used by hover + tree tooltip.
 *
 * Only renders fields that are present; gracefully degrades when
 * `description`, `version`, `license`, or `help` are null/absent.
 */
export function buildToolInfoMarkdown(tool: ParsedTool, opts: ToolInfoMarkdownOptions = {}): string {
  const helpMax = opts.helpExcerptChars ?? DEFAULT_HELP_CHARS;
  const lines: string[] = [];

  const header =
    tool.version != null
      ? `**${tool.name}** (\`${tool.id}@${tool.version}\`)`
      : `**${tool.name}** (\`${tool.id}\`)`;
  lines.push(header);

  if (tool.description) {
    lines.push("");
    lines.push(`> ${tool.description}`);
  }

  const meta: string[] = [];
  if (tool.license) meta.push(`License: ${tool.license}`);
  if (tool.edam_operations.length > 0) {
    meta.push(`EDAM operations: ${tool.edam_operations.join(", ")}`);
  }
  if (tool.edam_topics.length > 0) {
    meta.push(`EDAM topics: ${tool.edam_topics.join(", ")}`);
  }
  if (tool.xrefs.length > 0) {
    meta.push(`Xrefs: ${tool.xrefs.map(renderXref).join(", ")}`);
  }
  if (tool.citations.length > 0) {
    meta.push(`Citations: ${tool.citations.length}`);
  }
  const toolShedUrl = parseToolShedRepoUrl(tool.id);
  if (toolShedUrl) {
    meta.push(`[Open in ToolShed](${toolShedUrl})`);
  }
  if (meta.length > 0) {
    lines.push("");
    for (const entry of meta) lines.push(`- ${entry}`);
  }

  if (tool.help && tool.help.content) {
    lines.push("");
    lines.push("---");
    lines.push(truncate(tool.help.content.trim(), helpMax));
  }

  return lines.join("\n");
}
