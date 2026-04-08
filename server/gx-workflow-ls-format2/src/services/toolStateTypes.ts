/**
 * Re-exports of @galaxy-tool-util/schema types and guards for tool-state services,
 * plus local aliases (for backward compat) and AST helpers that must live here.
 */

import { ASTNode, ArrayASTNode, NodePath, ObjectASTNode, PropertyASTNode } from "@gxwf/server-common/src/ast/types";
import { ASTNodeManager } from "@gxwf/server-common/src/ast/nodeManager";

export type {
  BooleanParameterModel as BooleanParam,
  ConditionalParameterModel as ConditionalParam,
  ConditionalWhen,
  LabelValue as SelectOption,
  RepeatParameterModel as RepeatParam,
  SectionParameterModel as SectionParam,
  SelectParameterModel,
  GenomeBuildParameterModel,
  ToolParameterModel as ToolParam,
} from "@galaxy-tool-util/schema";

export {
  isBooleanParam,
  isConditionalParam,
  isRepeatParam,
  isSectionParam,
} from "@galaxy-tool-util/schema";

// ---------------------------------------------------------------------------
// Local aliases / overrides
// ---------------------------------------------------------------------------

import type {
  GenomeBuildParameterModel,
  SelectParameterModel,
  ToolParameterModel,
} from "@galaxy-tool-util/schema";

/** Select-like params: gx_select and gx_genomebuild (both have flat LabelValue options). */
export type SelectParam = SelectParameterModel | GenomeBuildParameterModel;

export function isSelectParam(p: ToolParameterModel): p is SelectParam {
  return p.parameter_type === "gx_select" || p.parameter_type === "gx_genomebuild";
}

export function isHidden(p: ToolParameterModel): boolean {
  return "hidden" in p && !!(p as { hidden: boolean }).hidden;
}

// ---------------------------------------------------------------------------
// AST helpers (extension-specific, not upstreamable)
// ---------------------------------------------------------------------------

/** Minimal common fields shared by all ToolParam variants (for display purposes). */
export interface ToolParamBase {
  name: string;
  label: string | null;
  help: string | null;
}

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
  if (val?.type === "string") return val.value;
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
// Step-iteration helper (shared by validation and cleaning)
// ---------------------------------------------------------------------------

export interface StepStateContext {
  toolId: string;
  toolVersion?: string;
  /** The tool_id value node — used to attach "not cached" diagnostics. */
  toolIdNode: ASTNode;
  stateKey: "state" | "tool_state";
  stateValueNode: ObjectASTNode;
  stepNode: ObjectASTNode;
}

/**
 * Iterate all workflow steps that have both a `tool_id` and a structured
 * (object-valued) `state` or `tool_state` block.
 * JSON-string `tool_state` values are skipped.
 */
export function collectStepsWithState(nodeManager: ASTNodeManager): StepStateContext[] {
  const result: StepStateContext[] = [];
  for (const stepNode of nodeManager.getStepNodes()) {
    const toolIdProp = stepNode.properties.find((p) => p.keyNode.value === "tool_id");
    const toolId =
      toolIdProp?.valueNode?.type === "string" ? String(toolIdProp.valueNode.value) : undefined;
    if (!toolId || !toolIdProp?.valueNode) continue;

    const toolVersionProp = stepNode.properties.find((p) => p.keyNode.value === "tool_version");
    const toolVersion =
      toolVersionProp?.valueNode?.type === "string"
        ? String(toolVersionProp.valueNode.value)
        : undefined;

    const stateProp =
      stepNode.properties.find((p) => p.keyNode.value === "state") ??
      stepNode.properties.find((p) => p.keyNode.value === "tool_state");
    if (!stateProp?.valueNode || stateProp.valueNode.type !== "object") continue;

    result.push({
      toolId,
      toolVersion,
      toolIdNode: toolIdProp.valueNode,
      stateKey: stateProp.keyNode.value as "state" | "tool_state",
      stateValueNode: stateProp.valueNode as ObjectASTNode,
      stepNode,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Dot-path YAML navigation (shared by validation and cleaning)
// ---------------------------------------------------------------------------

/**
 * Walk a dot-separated path through a YAML ObjectASTNode tree and return the
 * `PropertyASTNode` at the final segment, or null if navigation fails.
 *
 * Handles numeric array indices as intermediate segments (e.g. for repeat groups:
 * `repeat_group.0.param_name`). The final segment must be an object property key.
 */
export function dotPathToYamlProperty(
  stateNode: ObjectASTNode,
  dotPath: string
): PropertyASTNode | null {
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
      const prop = (current as ObjectASTNode).properties.find(
        (p) => String(p.keyNode.value) === seg
      );
      if (!prop?.valueNode) return null;
      current = prop.valueNode;
    }
  }

  if (current.type !== "object") return null;
  const lastSeg = segments[segments.length - 1];
  return (current as ObjectASTNode).properties.find(
    (p) => String(p.keyNode.value) === lastSeg
  ) ?? null;
}

/**
 * Convert a YAML ObjectASTNode to a nested plain dict for upstream param navigation.
 * Preserves native boolean values so selectWhichWhen can match boolean discriminators.
 */
export function yamlObjectNodeToRecord(node: ObjectASTNode): Record<string, unknown> {
  const dict: Record<string, unknown> = {};
  for (const prop of node.properties) {
    const key = String(prop.keyNode.value);
    const val = prop.valueNode;
    if (!val) continue;
    if (val.type === "string") dict[key] = String(val.value);
    if (val.type === "boolean") dict[key] = Boolean(val.value);
    if (val.type === "number") dict[key] = Number(val.value);
    if (val.type === "object") dict[key] = yamlObjectNodeToRecord(val as ObjectASTNode);
    if (val.type === "array") {
      // Repeat arrays: include object items for validation. selectWhichWhen only uses
      // scalars so the extra array data is ignored during param navigation.
      dict[key] = (val as ArrayASTNode).items
        .filter((item) => item.type === "object")
        .map((item) => yamlObjectNodeToRecord(item as ObjectASTNode));
    }
  }
  return dict;
}
