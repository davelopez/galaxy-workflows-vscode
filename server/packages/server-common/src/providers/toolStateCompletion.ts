/**
 * Shared tool-state completion logic for format2 and native workflow documents.
 *
 * `StateInPath`, `findStateInPath`, `CompletionTextContext`, `getCompletionTextContext`,
 * and `ToolStateCompletionService` all live here so that native can use them
 * without depending on the YAML language service.
 */
import {
  findParamAtPath,
  isBooleanParam,
  isConditionalParam,
  isRepeatParam,
  isSectionParam,
} from "@galaxy-tool-util/schema";
import type { ToolParameterModel } from "@galaxy-tool-util/schema";
import type { ASTNode, NodePath } from "../ast/types";
import { CompletionItem, CompletionItemKind } from "../languageTypes";
import type { ToolRegistryService } from "../languageTypes";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Range } from "vscode-languageserver-types";
import {
  ToolParam,
  ToolParamBase,
  isHidden,
  isSelectParam,
  getStringPropertyFromStep,
  getObjectNodeFromStep,
  astObjectNodeToRecord,
} from "./validation/toolStateAstHelpers";

// ---------------------------------------------------------------------------
// Path detection
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
// Completion text context (replaces TextBuffer dependency)
// ---------------------------------------------------------------------------

export interface CompletionTextContext {
  afterColon: boolean;
  currentWord: string;
  overwriteRange: Range;
}

/** Word boundary characters — identical to TextBuffer used by format2. */
const WORD_BOUNDARIES = ' \t\n\r\v":{[,]}';

/**
 * Compute the completion text context at `offset` in `doc`.
 * Replicates `TextBuffer.getCurrentWord`, `getCurrentWordRange`, and
 * `isPositionAfterToken` without importing the YAML language service.
 */
export function getCompletionTextContext(doc: TextDocument, offset: number): CompletionTextContext {
  const text = doc.getText();

  // Scan backward to find the start of the current word
  let i = offset - 1;
  while (i >= 0 && WORD_BOUNDARIES.indexOf(text.charAt(i)) === -1) {
    i--;
  }
  const wordStart = i + 1;
  const currentWord = text.substring(wordStart, offset);
  const overwriteRange = Range.create(doc.positionAt(wordStart), doc.positionAt(offset));

  // Check if position is after ":" on the same line
  const pos = doc.positionAt(offset);
  const lineStartOffset = doc.offsetAt({ line: pos.line, character: 0 });
  const lineText = text.substring(lineStartOffset, offset);
  const colonIdx = lineText.lastIndexOf(":");
  const afterColon = colonIdx !== -1 && colonIdx < pos.character;

  return { afterColon, currentWord, overwriteRange };
}

// ---------------------------------------------------------------------------
// Completion item builders
// ---------------------------------------------------------------------------

type OverwriteRange = { start: { line: number; character: number }; end: { line: number; character: number } };

/** Convert gx_integer → "integer", gx_select → "select", etc. */
function paramTypeDetail(param: ToolParameterModel): string {
  const pt = param.parameter_type;
  return pt.startsWith("gx_") ? pt.slice(3) : pt;
}

function nameCompletionItem(param: ToolParameterModel, overwriteRange: OverwriteRange): CompletionItem {
  const base = param as unknown as ToolParamBase;
  const label = base.name;
  const doc = base.help ?? base.label ?? undefined;
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

function valueCompletionItem(value: string, humanLabel: string, overwriteRange: OverwriteRange): CompletionItem {
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
    textCtx: CompletionTextContext,
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

    const { afterColon, currentWord, overwriteRange } = textCtx;

    // Build state dict for conditional branch filtering
    const stateNode = getObjectNodeFromStep(root, stepPath, stateInfo.stateKey);
    const stateDict = stateNode ? astObjectNodeToRecord(stateNode) : undefined;

    const result = findParamAtPath(params, innerPath, stateDict);

    // Value completion: cursor is after ":" on a leaf param
    if (result.param && afterColon) {
      return this.valueItems(result.param, currentWord, overwriteRange);
    }

    // Name completion: determine which params are available at the cursor level
    let contextParams: ToolParam[];
    if (result.param && !afterColon) {
      if (isSectionParam(result.param) || isRepeatParam(result.param)) {
        contextParams = result.param.parameters as ToolParam[];
      } else if (isConditionalParam(result.param)) {
        const inner = findParamAtPath(params, [...innerPath, ""], stateDict);
        contextParams = inner.availableParams as ToolParam[];
      } else {
        contextParams = result.availableParams as ToolParam[];
      }
    } else {
      contextParams = result.availableParams as ToolParam[];
    }

    return contextParams
      .filter((p) => !isHidden(p))
      .filter((p) => (p as unknown as ToolParamBase).name.startsWith(currentWord))
      .filter((p) => !existingKeys.has((p as unknown as ToolParamBase).name))
      .map((p) => nameCompletionItem(p, overwriteRange));
  }

  private valueItems(param: ToolParam, currentWord: string, overwriteRange: OverwriteRange): CompletionItem[] {
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
