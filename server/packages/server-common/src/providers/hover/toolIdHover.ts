import type { ObjectASTNode, PropertyASTNode } from "../../ast/types";
import type { ASTNodeManager } from "../../ast/nodeManager";
import type { Hover, Range, ToolRegistryService } from "../../languageTypes";
import { MarkupKind } from "../../languageTypes";
import {
  TOOL_NOT_CACHED_HEADLINE,
  TOOL_NOT_CACHED_HINT,
  TOOL_RESOLUTION_FAILED_HEADLINE,
} from "../../../../../../shared/src/toolStatePresentation";
import { buildToolInfoMarkdown } from "./toolInfoMarkdown";

export interface BuildToolIdHoverArgs {
  nodeManager: ASTNodeManager;
  offset: number;
  registry: ToolRegistryService;
}

/**
 * If the cursor is on a `tool_id` property (or its value) inside a `steps` block,
 * build a Hover describing the parsed tool (or a fallback message when the tool
 * isn't cached / resolution failed). Returns `null` otherwise.
 */
export async function buildToolIdHover(args: BuildToolIdHoverArgs): Promise<Hover | null> {
  const { nodeManager, offset, registry } = args;
  const node = nodeManager.getNodeFromOffset(offset);
  if (!node) return null;

  let propertyNode: PropertyASTNode | null = null;
  if (node.type === "property" && node.keyNode.value === "tool_id") {
    propertyNode = node;
  } else if (node.type === "string") {
    const parent = node.parent;
    if (
      parent &&
      parent.type === "property" &&
      parent.keyNode.value === "tool_id" &&
      parent.keyNode !== node
    ) {
      propertyNode = parent;
    }
  }
  if (!propertyNode?.valueNode) return null;
  const valueNode = propertyNode.valueNode;
  if (valueNode.type !== "string") return null;

  const path = nodeManager.getPathFromNode(propertyNode);
  if (!path.includes("steps")) return null;

  const stepNode = propertyNode.parent;
  if (!stepNode || stepNode.type !== "object") return null;

  const toolId = valueNode.value;
  if (!toolId) return null;
  const toolVersion = getStringProperty(stepNode, "tool_version");
  const range: Range = nodeManager.getNodeRange(valueNode);

  if (registry.hasResolutionFailed(toolId, toolVersion)) {
    return hover(`**${TOOL_RESOLUTION_FAILED_HEADLINE}**\n\n\`${toolId}\``, range);
  }

  const tool = await registry.getToolInfo(toolId, toolVersion);
  if (!tool) {
    return hover(`**${TOOL_NOT_CACHED_HEADLINE}**\n\n\`${toolId}\`\n\n${TOOL_NOT_CACHED_HINT}`, range);
  }
  return hover(buildToolInfoMarkdown(tool), range);
}

function getStringProperty(obj: ObjectASTNode, key: string): string | undefined {
  const prop = obj.properties.find((p) => p.keyNode.value === key);
  const value = prop?.valueNode;
  if (!value) return undefined;
  if (value.type === "string") return value.value;
  if (value.type === "number" || value.type === "boolean") return String(value.value);
  return undefined;
}

function hover(markdown: string, range: Range): Hover {
  return {
    contents: { kind: MarkupKind.Markdown, value: markdown },
    range,
  };
}
