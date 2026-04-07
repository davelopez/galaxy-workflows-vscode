import { findParamAtPath } from "@galaxy-tool-util/schema";
import { ASTNode, NodePath } from "@gxwf/server-common/src/ast/types";
import { CompletionItem, CompletionItemKind, ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { TextBuffer } from "@gxwf/yaml-language-service/src/utils/textBuffer";
import {
  ToolParam,
  ToolParamBase,
  getObjectNodeFromStep,
  getStringPropertyFromStep,
  isBooleanParam,
  isConditionalParam,
  isHidden,
  isRepeatParam,
  isSelectParam,
  isSectionParam,
  yamlObjectNodeToRecord,
} from "./toolStateTypes";

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

    // Build state dict for conditional branch filtering
    const stateNode = getObjectNodeFromStep(root, stepPath, stateInfo.stateKey);
    const stateDict = stateNode ? yamlObjectNodeToRecord(stateNode) : undefined;

    const result = findParamAtPath(params, innerPath, stateDict);

    // Value completion: cursor is after ":" on a leaf param
    if (result.param && afterColon) {
      return this.valueItems(result.param, currentWord, overwriteRange);
    }

    // Name completion: determine which params are available at the cursor level
    let contextParams: ToolParam[];
    if (result.param && !afterColon) {
      // Cursor is positioned AT a container param key — show its children
      if (isSectionParam(result.param) || isRepeatParam(result.param)) {
        contextParams = result.param.parameters as ToolParam[];
      } else if (isConditionalParam(result.param)) {
        // Navigate into the conditional to get branch-filtered children;
        // using an empty-string sentinel causes findParamAtPath to resolve
        // the branch and return its children as availableParams.
        const inner = findParamAtPath(params, [...innerPath, ""], stateDict);
        contextParams = inner.availableParams as ToolParam[];
      } else {
        // Leaf param at cursor (no afterColon) — show siblings
        contextParams = result.availableParams as ToolParam[];
      }
    } else {
      contextParams = result.availableParams as ToolParam[];
    }

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
