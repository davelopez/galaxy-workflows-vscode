import { ASTNode, NodePath, ObjectASTNode, Segment } from "@gxwf/server-common/src/ast/types";
import { CompletionItem, CompletionItemKind, ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { TextBuffer } from "@gxwf/yaml-language-service/src/utils/textBuffer";

// Minimal type definitions mirroring @galaxy-tool-util/schema bundle-types.
// These are the shapes we care about for completion purposes.

interface SelectOption {
  label: string;
  value: string;
}

interface ToolParamBase {
  name: string;
  parameter_type: string;
  label?: string | null;
  help?: string | null;
  hidden?: boolean;
}

interface SelectParam extends ToolParamBase {
  parameter_type: "gx_select" | "gx_genomebuild" | "gx_drill_down";
  options: SelectOption[] | null;
}

interface BooleanParam extends ToolParamBase {
  parameter_type: "gx_boolean";
}

interface SectionParam extends ToolParamBase {
  parameter_type: "gx_section";
  parameters: ToolParam[];
}

interface RepeatParam extends ToolParamBase {
  parameter_type: "gx_repeat";
  parameters: ToolParam[];
}

interface ConditionalParam extends ToolParamBase {
  parameter_type: "gx_conditional";
  test_parameter: ToolParam;
  whens: Array<{ parameters: ToolParam[] }>;
}

type ToolParam =
  | ToolParamBase
  | SelectParam
  | BooleanParam
  | SectionParam
  | RepeatParam
  | ConditionalParam;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

export interface StateInPath {
  stateIndex: number;
  stateKey: "state" | "tool_state";
}

/**
 * Checks whether `path` contains "state" or "tool_state" at a workflow step level
 * (i.e. preceded by "steps" + step-name segments).
 * Returns the index of the state segment and the key name, or undefined.
 */
export function findStateInPath(path: NodePath): StateInPath | undefined {
  for (let i = 2; i < path.length; i++) {
    const seg = path[i];
    if ((seg === "state" || seg === "tool_state") && path[i - 2] === "steps") {
      return { stateIndex: i, stateKey: seg };
    }
  }
  return undefined;
}

/**
 * Navigate the AST from root using `stepPath` segments and return the string value
 * of `propertyName` on the resulting object node, or undefined.
 */
function getStringPropertyFromStep(
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

// ---------------------------------------------------------------------------
// Parameter tree navigation
// ---------------------------------------------------------------------------

function isSelectParam(p: ToolParam): p is SelectParam {
  const pt = p.parameter_type;
  return pt === "gx_select" || pt === "gx_genomebuild" || pt === "gx_drill_down";
}

function isBooleanParam(p: ToolParam): p is BooleanParam {
  return p.parameter_type === "gx_boolean";
}

function isSectionParam(p: ToolParam): p is SectionParam {
  return p.parameter_type === "gx_section";
}

function isRepeatParam(p: ToolParam): p is RepeatParam {
  return p.parameter_type === "gx_repeat";
}

function isConditionalParam(p: ToolParam): p is ConditionalParam {
  return p.parameter_type === "gx_conditional";
}

function isHidden(p: ToolParam): boolean {
  return !!(p as ToolParamBase).hidden;
}

interface NavResult {
  params: ToolParam[];
  mode: "names" | "value";
  targetParam?: ToolParam;
}

/**
 * Navigate the parameter tree along `innerPath` to determine the completion context.
 * Returns the list of parameters available at the current level and whether we're
 * completing a property name or a value.
 */
function navigateParams(params: ToolParam[], innerPath: Segment[], afterColon: boolean): NavResult {
  if (innerPath.length === 0) {
    return { params, mode: "names" };
  }

  const head = innerPath[0];
  const tail = innerPath.slice(1);

  // Skip numeric segments (array indices from repeat instances)
  if (typeof head === "number") {
    return navigateParams(params, tail, afterColon);
  }

  const match = params.find((p) => p.name === head);

  if (!match) {
    // Unknown segment — still offer names at this level
    return { params, mode: "names" };
  }

  if (tail.length === 0) {
    // We're AT this parameter
    if (afterColon) {
      return { params, mode: "value", targetParam: match };
    }
    // Not after colon — still completing at this level
    if (isSectionParam(match)) return { params: match.parameters, mode: "names" };
    if (isRepeatParam(match)) return { params: match.parameters, mode: "names" };
    if (isConditionalParam(match)) {
      const allParams = [match.test_parameter, ...match.whens.flatMap((w) => w.parameters)];
      return { params: allParams, mode: "names" };
    }
    return { params, mode: "names" };
  }

  // Navigate deeper
  if (isSectionParam(match)) return navigateParams(match.parameters, tail, afterColon);
  if (isRepeatParam(match)) return navigateParams(match.parameters, tail, afterColon);
  if (isConditionalParam(match)) {
    const allParams = [match.test_parameter, ...match.whens.flatMap((w) => w.parameters)];
    return navigateParams(allParams, tail, afterColon);
  }

  return { params, mode: "names" };
}

// ---------------------------------------------------------------------------
// Completion item builders
// ---------------------------------------------------------------------------

/** Convert gx_integer → "integer", gx_select → "select", etc. */
function paramTypeDetail(param: ToolParam): string {
  const pt = param.parameter_type;
  return pt.startsWith("gx_") ? pt.slice(3) : pt;
}

function nameCompletionItem(param: ToolParam, overwriteRange: { start: { line: number; character: number }; end: { line: number; character: number } }): CompletionItem {
  const label = param.name;
  const doc = (param as ToolParamBase).help ?? (param as ToolParamBase).label ?? undefined;
  return {
    label,
    detail: paramTypeDetail(param),
    kind: CompletionItemKind.Field,
    documentation: doc ?? undefined,
    sortText: `_${label}`,
    insertText: `${label}: `,
    textEdit: {
      range: overwriteRange,
      newText: `${label}: `,
    },
  };
}

function valueCompletionItem(
  value: string,
  humanLabel: string,
  overwriteRange: { start: { line: number; character: number }; end: { line: number; character: number } }
): CompletionItem {
  return {
    label: value,
    kind: CompletionItemKind.EnumMember,
    documentation: humanLabel !== value ? humanLabel : undefined,
    sortText: `_${value}`,
    insertText: value,
    textEdit: {
      range: overwriteRange,
      newText: value,
    },
  };
}

// ---------------------------------------------------------------------------
// ToolStateCompletionService
// ---------------------------------------------------------------------------

export class ToolStateCompletionService {
  constructor(private readonly toolRegistryService: ToolRegistryService) {}

  async doComplete(
    root: ASTNode | undefined,
    nodePath: NodePath,
    stateInfo: StateInPath,
    textBuffer: TextBuffer,
    offset: number,
    existingKeys: Set<string>
  ): Promise<CompletionItem[]> {
    const stepPath = nodePath.slice(0, stateInfo.stateIndex);
    const innerPath = nodePath.slice(stateInfo.stateIndex + 1);

    const toolId = getStringPropertyFromStep(root, stepPath, "tool_id");
    if (!toolId) return [];

    const toolVersion = getStringPropertyFromStep(root, stepPath, "tool_version");

    const rawParams = await this.toolRegistryService.getToolParameters(toolId, toolVersion);
    if (!rawParams) return [];

    const params = rawParams as ToolParam[];

    const position = textBuffer.getPosition(offset);
    const afterColon = textBuffer.isPositionAfterToken(position, ":");
    const overwriteRange = textBuffer.getCurrentWordRange(offset);
    const currentWord = textBuffer.getCurrentWord(offset);

    const { params: contextParams, mode, targetParam } = navigateParams(params, innerPath, afterColon);

    if (mode === "value" && targetParam) {
      return this.valueItems(targetParam, currentWord, overwriteRange);
    }

    // Complete property names
    return contextParams
      .filter((p) => !isHidden(p))
      .filter((p) => p.name.startsWith(currentWord))
      .filter((p) => !existingKeys.has(p.name))
      .map((p) => nameCompletionItem(p, overwriteRange));
  }

  private valueItems(
    param: ToolParam,
    currentWord: string,
    overwriteRange: { start: { line: number; character: number }; end: { line: number; character: number } }
  ): CompletionItem[] {
    if (isSelectParam(param)) {
      const options = param.options ?? [];
      return options
        .filter((o) => o.value.startsWith(currentWord))
        .map((o) => valueCompletionItem(o.value, o.label, overwriteRange));
    }

    if (isBooleanParam(param)) {
      return ["true", "false"]
        .filter((v) => v.startsWith(currentWord))
        .map((v) => valueCompletionItem(v, v, overwriteRange));
    }

    return [];
  }
}
