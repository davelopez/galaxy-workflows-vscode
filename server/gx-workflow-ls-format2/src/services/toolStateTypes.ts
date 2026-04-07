/**
 * Minimal type definitions mirroring @galaxy-tool-util/schema bundle-types.
 * Used by tool-state completion, validation, and hover services.
 */

import { ASTNode, NodePath, ObjectASTNode } from "@gxwf/server-common/src/ast/types";

export interface SelectOption {
  label: string;
  value: string;
}

export interface ToolParamBase {
  name: string;
  parameter_type: string;
  label?: string | null;
  help?: string | null;
  hidden?: boolean;
}

export interface SelectParam extends ToolParamBase {
  parameter_type: "gx_select" | "gx_genomebuild" | "gx_drill_down";
  options: SelectOption[] | null;
}

export interface BooleanParam extends ToolParamBase {
  parameter_type: "gx_boolean";
}

export interface SectionParam extends ToolParamBase {
  parameter_type: "gx_section";
  parameters: ToolParam[];
}

export interface RepeatParam extends ToolParamBase {
  parameter_type: "gx_repeat";
  parameters: ToolParam[];
}

export interface ConditionalParam extends ToolParamBase {
  parameter_type: "gx_conditional";
  test_parameter: ToolParam;
  whens: Array<{ parameters: ToolParam[] }>;
}

export type ToolParam =
  | ToolParamBase
  | SelectParam
  | BooleanParam
  | SectionParam
  | RepeatParam
  | ConditionalParam;

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isSelectParam(p: ToolParam): p is SelectParam {
  const pt = p.parameter_type;
  return pt === "gx_select" || pt === "gx_genomebuild" || pt === "gx_drill_down";
}

export function isBooleanParam(p: ToolParam): p is BooleanParam {
  return p.parameter_type === "gx_boolean";
}

export function isSectionParam(p: ToolParam): p is SectionParam {
  return p.parameter_type === "gx_section";
}

export function isRepeatParam(p: ToolParam): p is RepeatParam {
  return p.parameter_type === "gx_repeat";
}

export function isConditionalParam(p: ToolParam): p is ConditionalParam {
  return p.parameter_type === "gx_conditional";
}

export function isHidden(p: ToolParam): boolean {
  return !!(p as ToolParamBase).hidden;
}

// ---------------------------------------------------------------------------
// AST helpers
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
