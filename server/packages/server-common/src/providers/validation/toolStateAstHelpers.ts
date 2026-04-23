/**
 * Format-agnostic AST helpers for tool-state validation.
 *
 * These functions operate on the shared ObjectASTNode/ArrayASTNode types and
 * work identically on YAML (format2) and JSON (native) ASTs — the "yaml" in
 * legacy names was misleading; the logic has no format dependence.
 */
import type { ASTNode, ArrayASTNode, NodePath, ObjectASTNode, PropertyASTNode, StringASTNode } from "../../ast/types";
import { ASTNodeManager } from "../../ast/nodeManager";
import { Range } from "vscode-languageserver-types";
import type { GenomeBuildParameterModel, SelectParameterModel, ToolParameterModel } from "@galaxy-tool-util/schema";
import { isBooleanParam } from "@galaxy-tool-util/schema";

// ---------------------------------------------------------------------------
// Step iteration
// ---------------------------------------------------------------------------

export interface StepWithToolState {
  toolId: string;
  toolVersion?: string;
  /** The string-valued tool_id AST node — used for "not cached" diagnostics. */
  toolIdNode: ASTNode;
  /** The object-valued tool_state/state node. */
  stateValueNode: ObjectASTNode;
  /** The containing step object node (for sibling properties like input_connections). */
  stepNode: ObjectASTNode;
}

/**
 * Iterate all workflow steps that have both a `tool_id` and an object-valued
 * `tool_state` (or `state`) block. JSON-string `tool_state` values are skipped.
 */
export function collectStepsWithObjectState(nodeManager: ASTNodeManager): StepWithToolState[] {
  const result: StepWithToolState[] = [];
  for (const stepNode of nodeManager.getStepNodes()) {
    const toolIdProp = stepNode.properties.find((p) => p.keyNode.value === "tool_id");
    const toolId = toolIdProp?.valueNode?.type === "string" ? String(toolIdProp.valueNode.value) : undefined;
    if (!toolId || !toolIdProp?.valueNode) continue;

    const toolVersionProp = stepNode.properties.find((p) => p.keyNode.value === "tool_version");
    const toolVersion =
      toolVersionProp?.valueNode?.type === "string" ? String(toolVersionProp.valueNode.value) : undefined;

    // Accept both "state" (format2) and "tool_state" (native) keys.
    const stateProp =
      stepNode.properties.find((p) => p.keyNode.value === "state") ??
      stepNode.properties.find((p) => p.keyNode.value === "tool_state");
    if (!stateProp?.valueNode || stateProp.valueNode.type !== "object") continue;

    result.push({
      toolId,
      toolVersion,
      toolIdNode: toolIdProp.valueNode,
      stateValueNode: stateProp.valueNode as ObjectASTNode,
      stepNode,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// ObjectASTNode → plain record
// ---------------------------------------------------------------------------

/**
 * Recursively convert an ObjectASTNode to a plain dict for upstream validators.
 * Preserves native boolean and number values so conditional-param matching works.
 */
export function astObjectNodeToRecord(node: ObjectASTNode): Record<string, unknown> {
  const dict: Record<string, unknown> = {};
  for (const prop of node.properties) {
    const key = String(prop.keyNode.value);
    const val = prop.valueNode;
    if (!val) continue;
    if (val.type === "string") dict[key] = String(val.value);
    if (val.type === "boolean") dict[key] = Boolean(val.value);
    if (val.type === "number") dict[key] = Number(val.value);
    if (val.type === "null") dict[key] = null;
    if (val.type === "object") dict[key] = astObjectNodeToRecord(val as ObjectASTNode);
    if (val.type === "array") {
      dict[key] = (val as ArrayASTNode).items
        .filter((item) => item.type === "object")
        .map((item) => astObjectNodeToRecord(item as ObjectASTNode));
    }
  }
  return dict;
}

// ---------------------------------------------------------------------------
// Dot-path navigation
// ---------------------------------------------------------------------------

/**
 * Walk a dot-separated path through an ObjectASTNode tree and return the
 * PropertyASTNode at the final segment, or null if navigation fails.
 *
 * Handles numeric array indices as intermediate segments (e.g. repeat groups:
 * `repeat_group.0.param_name`). The final segment must be an object property key.
 */
export function dotPathToAstProperty(stateNode: ObjectASTNode, dotPath: string): PropertyASTNode | null {
  if (!dotPath) return null;
  const segments = dotPath.split(".");
  let current: ASTNode = stateNode;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const idx = Number(seg);
    if (!isNaN(idx) && String(idx) === seg && current.type === "array") {
      const item = (current as ArrayASTNode).items[idx];
      if (!item) return null;
      current = item;
    } else {
      if (current.type !== "object") return null;
      const found = (current as ObjectASTNode).properties.find((p) => String(p.keyNode.value) === seg);
      if (!found?.valueNode) return null;
      current = found.valueNode;
    }
  }

  if (current.type !== "object") return null;
  const lastSeg = segments[segments.length - 1];
  return (current as ObjectASTNode).properties.find((p) => String(p.keyNode.value) === lastSeg) ?? null;
}

/**
 * Walk a dot-separated path through an ObjectASTNode tree and return the LSP
 * Range of the final property's key (for unknown-key diagnostics) or value node
 * (for value-error diagnostics). Falls back to the state node range when
 * navigation fails.
 */
export function dotPathToAstRange(
  stateNode: ObjectASTNode,
  dotPath: string,
  nodeManager: ASTNodeManager,
  target: "key" | "value" = "key"
): Range {
  if (!dotPath) return nodeManager.getNodeRange(stateNode);

  const prop = dotPathToAstProperty(stateNode, dotPath);
  if (prop) {
    const node = target === "value" && prop.valueNode ? prop.valueNode : prop.keyNode;
    return nodeManager.getNodeRange(node);
  }

  // Fallback: numeric last segment (bare repeat-item index).
  const segments = dotPath.split(".");
  let current: ASTNode = stateNode;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const idx = Number(seg);
    if (!isNaN(idx) && String(idx) === seg && current.type === "array") {
      const item = (current as ArrayASTNode).items[idx];
      if (!item) return nodeManager.getNodeRange(stateNode);
      current = item;
    } else {
      if (current.type !== "object") return nodeManager.getNodeRange(stateNode);
      const found = (current as ObjectASTNode).properties.find((p) => String(p.keyNode.value) === segments[i]);
      if (!found?.valueNode) return nodeManager.getNodeRange(stateNode);
      current = found.valueNode;
    }
  }
  const lastIdx = Number(segments[segments.length - 1]);
  if (!isNaN(lastIdx) && current.type === "array") {
    const item = (current as ArrayASTNode).items[lastIdx];
    return item ? nodeManager.getNodeRange(item) : nodeManager.getNodeRange(stateNode);
  }

  return nodeManager.getNodeRange(stateNode);
}

// ---------------------------------------------------------------------------
// Step navigation helpers (shared by hover, completion, and validation)
// ---------------------------------------------------------------------------

/**
 * Navigate the AST from root along `stepPath` segments and return the string
 * value of `propertyName` on the resulting step object, or undefined.
 */
export function getStringPropertyFromStep(
  root: ASTNode | undefined,
  stepPath: NodePath,
  propertyName: string
): string | undefined {
  let current: ASTNode | undefined = root;
  for (const seg of stepPath) {
    if (!current || current.type !== "object") return undefined;
    const prop = (current as ObjectASTNode).properties.find((p) => p.keyNode.value === seg);
    current = prop?.valueNode;
  }
  if (!current || current.type !== "object") return undefined;
  const prop = (current as ObjectASTNode).properties.find((p) => p.keyNode.value === propertyName);
  const val = prop?.valueNode;
  if (val?.type === "string") return String(val.value);
  return undefined;
}

/**
 * Navigate the AST from root along `stepPath` segments and return the object
 * value node of `propertyName` on the resulting step object, or undefined.
 */
export function getObjectNodeFromStep(
  root: ASTNode | undefined,
  stepPath: NodePath,
  propertyName: string
): ObjectASTNode | undefined {
  let current: ASTNode | undefined = root;
  for (const seg of stepPath) {
    if (!current || current.type !== "object") return undefined;
    const prop = (current as ObjectASTNode).properties.find((p) => p.keyNode.value === seg);
    current = prop?.valueNode;
  }
  if (!current || current.type !== "object") return undefined;
  const prop = (current as ObjectASTNode).properties.find((p) => p.keyNode.value === propertyName);
  const val = prop?.valueNode;
  return val?.type === "object" ? (val as ObjectASTNode) : undefined;
}

// ---------------------------------------------------------------------------
// Tool param display helpers (shared by hover and completion)
// ---------------------------------------------------------------------------

export type ToolParam = ToolParameterModel;
export type SelectParam = SelectParameterModel | GenomeBuildParameterModel;

/** Minimal common fields accessible on all ToolParameterModel galaxy variants. */
export interface ToolParamBase {
  name: string;
  parameter_type: string;
  label: string | null;
  help: string | null;
}

export function isSelectParam(p: ToolParameterModel): p is SelectParam {
  return p.parameter_type === "gx_select" || p.parameter_type === "gx_genomebuild";
}

export function isHidden(p: ToolParameterModel): boolean {
  return "hidden" in p && !!(p as { hidden: boolean }).hidden;
}

export function buildParamHoverMarkdown(param: ToolParam): string {
  const base = param as unknown as ToolParamBase;
  const typeLabel = base.parameter_type.startsWith("gx_") ? base.parameter_type.slice(3) : base.parameter_type;
  const lines: string[] = [];

  lines.push(`**${base.name}** \`${typeLabel}\``);
  if (base.label) lines.push(`_${base.label}_`);
  if (base.help) lines.push(base.help);

  if (isSelectParam(param) && param.options && param.options.length > 0) {
    lines.push("**Options:**");
    for (const opt of param.options) {
      lines.push(`- \`${opt.value}\` — ${opt.label}`);
    }
  } else if (isBooleanParam(param)) {
    lines.push("**Values:** `true` | `false`");
  }

  return lines.join("\n\n");
}
