/**
 * Re-exports of @galaxy-tool-util/schema types and guards for tool-state services,
 * plus local aliases (for backward compat) and AST helpers that must live here.
 */

import { ASTNode, NodePath, ObjectASTNode } from "@gxwf/server-common/src/ast/types";

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
