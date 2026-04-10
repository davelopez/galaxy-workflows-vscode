import type { NodePath, ObjectASTNode, ArrayASTNode } from "@gxwf/server-common/src/ast/types";
import { CompletionItem, CompletionItemKind, CompletionList, Position } from "@gxwf/server-common/src/languageTypes";
import type { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import {
  getStringPropertyFromStep,
  ToolParam,
  ToolParamBase,
} from "@gxwf/server-common/src/providers/validation/toolStateAstHelpers";
import { isConditionalParam, isRepeatParam, isSectionParam } from "@galaxy-tool-util/schema";
import type { ToolParameterModel } from "@galaxy-tool-util/schema";
import { getCompletionTextContext } from "@gxwf/server-common/src/providers/toolStateCompletion";
import { NativeWorkflowDocument } from "../nativeWorkflowDocument";

// ---------------------------------------------------------------------------
// Path detection
// ---------------------------------------------------------------------------

export type ConnectionField = "key" | "id" | "output_name";

export interface ConnectionInPath {
  stepKey: string;
  paramName?: string;
  field: ConnectionField;
}

/**
 * Detect whether `path` is inside a step's `input_connections` block and
 * return context about what field is being completed.
 *
 * Patterns:
 *   ["steps", stepKey, "input_connections"]                   → key (new param name)
 *   ["steps", stepKey, "input_connections", paramName]        → key (cursor on param name)
 *   ["steps", stepKey, "input_connections", paramName, "id"]  → id
 *   ["steps", stepKey, "input_connections", paramName, "output_name"] → output_name
 */
export function findConnectionInPath(path: NodePath): ConnectionInPath | undefined {
  const n = path.length;
  if (n < 3) return undefined;

  // Find "input_connections" segment preceded by "steps" + stepKey
  for (let i = 2; i < n; i++) {
    if (path[i] === "input_connections" && path[i - 2] === "steps") {
      const stepKey = String(path[i - 1]);
      const remaining = n - i - 1;

      if (remaining === 0) {
        // Cursor inside the input_connections object itself
        return { stepKey, field: "key" };
      }
      if (remaining === 1) {
        // Cursor on a paramName key
        return { stepKey, paramName: String(path[i + 1]), field: "key" };
      }
      if (remaining === 2) {
        const field = path[i + 2];
        if (field === "id") return { stepKey, paramName: String(path[i + 1]), field: "id" };
        if (field === "output_name") return { stepKey, paramName: String(path[i + 1]), field: "output_name" };
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Step navigation helpers (native-specific)
// ---------------------------------------------------------------------------

/**
 * Return integer step IDs of all steps whose `id` field is strictly less than
 * the current step's `id`. Prevents forward references.
 */
export function getAvailableStepIds(doc: NativeWorkflowDocument, currentStepKey: string): number[] {
  const nodeManager = doc.nodeManager;

  // Walk the steps object to correlate step key → integer id.
  // getStepNodes() returns ObjectASTNodes for step values, not the keyed properties,
  // so we iterate the steps object directly.
  let currentStepId: number | undefined;
  const root = nodeManager.root;
  if (!root || root.type !== "object") return [];

  const stepsProp = (root as ObjectASTNode).properties.find((p) => p.keyNode.value === "steps");
  if (!stepsProp?.valueNode || stepsProp.valueNode.type !== "object") return [];

  const stepsObj = stepsProp.valueNode as ObjectASTNode;
  const result: number[] = [];

  for (const stepProp of stepsObj.properties) {
    const stepKey = String(stepProp.keyNode.value);
    const stepNode = stepProp.valueNode;
    if (!stepNode || stepNode.type !== "object") continue;

    const idProp = (stepNode as ObjectASTNode).properties.find((p) => p.keyNode.value === "id");
    if (!idProp?.valueNode || idProp.valueNode.type !== "number") continue;

    const stepId = Number(idProp.valueNode.value);

    if (stepKey === currentStepKey) {
      currentStepId = stepId;
      continue;
    }

    result.push(stepId);
  }

  // Filter to only steps before the current step
  if (currentStepId === undefined) return result;
  return result.filter((id) => id < currentStepId!);
}

/**
 * Return output names from the step whose `id` field equals `sourceStepId`.
 * Falls back to `["output"]` if the outputs array is absent or empty.
 */
export function getStepOutputNames(doc: NativeWorkflowDocument, sourceStepId: number): string[] {
  const root = doc.nodeManager.root;
  if (!root || root.type !== "object") return ["output"];

  const stepsProp = (root as ObjectASTNode).properties.find((p) => p.keyNode.value === "steps");
  if (!stepsProp?.valueNode || stepsProp.valueNode.type !== "object") return ["output"];

  const stepsObj = stepsProp.valueNode as ObjectASTNode;

  for (const stepProp of stepsObj.properties) {
    const stepNode = stepProp.valueNode;
    if (!stepNode || stepNode.type !== "object") continue;

    const idProp = (stepNode as ObjectASTNode).properties.find((p) => p.keyNode.value === "id");
    if (!idProp?.valueNode || idProp.valueNode.type !== "number") continue;
    if (Number(idProp.valueNode.value) !== sourceStepId) continue;

    // Found the step — collect output names
    const outputsProp = (stepNode as ObjectASTNode).properties.find((p) => p.keyNode.value === "outputs");
    if (!outputsProp?.valueNode || outputsProp.valueNode.type !== "array") return ["output"];

    const names: string[] = [];
    for (const item of (outputsProp.valueNode as ArrayASTNode).items) {
      if (item.type !== "object") continue;
      const nameProp = (item as ObjectASTNode).properties.find((p) => p.keyNode.value === "name");
      if (nameProp?.valueNode?.type === "string") {
        names.push(String(nameProp.valueNode.value));
      }
    }
    return names.length > 0 ? names : ["output"];
  }

  return ["output"];
}

/**
 * Return parameter names connectable for the given step, flattened to
 * Galaxy's `|`-delimited path convention.
 * Returns empty if the tool is not cached.
 */
export async function getConnectableParamNames(
  doc: NativeWorkflowDocument,
  stepKey: string,
  toolRegistryService: ToolRegistryService
): Promise<string[]> {
  const root = doc.nodeManager.root;
  const stepPath = ["steps", stepKey];
  const toolId = getStringPropertyFromStep(root, stepPath, "tool_id");
  if (!toolId) return [];

  const toolVersion = getStringPropertyFromStep(root, stepPath, "tool_version");
  const rawParams = await toolRegistryService.getToolParameters(toolId, toolVersion);
  if (!rawParams) return [];

  return flattenParamNames(rawParams as ToolParam[]);
}

function flattenParamNames(params: ToolParameterModel[], prefix = ""): string[] {
  const names: string[] = [];
  for (const param of params) {
    const name = prefix ? `${prefix}|${(param as unknown as ToolParamBase).name}` : (param as unknown as ToolParamBase).name;
    if (isSectionParam(param) || isRepeatParam(param)) {
      names.push(...flattenParamNames(param.parameters as ToolParameterModel[], name));
    } else if (isConditionalParam(param)) {
      const testName = prefix
        ? `${prefix}|${(param.test_parameter as unknown as ToolParamBase).name}`
        : (param.test_parameter as unknown as ToolParamBase).name;
      names.push(testName);
      for (const when of param.whens) {
        names.push(...flattenParamNames(when.parameters as ToolParameterModel[], name));
      }
    } else {
      names.push(name);
    }
  }
  return names;
}

// ---------------------------------------------------------------------------
// Completion service
// ---------------------------------------------------------------------------

export class NativeWorkflowConnectionService {
  constructor(private readonly toolRegistryService: ToolRegistryService) {}

  /**
   * Returns connection completions if the cursor is inside `input_connections`,
   * otherwise returns null.
   */
  public async doCompleteAt(doc: NativeWorkflowDocument, position: Position): Promise<CompletionList | null> {
    const textDocument = doc.textDocument;
    const nodeManager = doc.nodeManager;
    const offset = textDocument.offsetAt(position);
    const node = nodeManager.getNodeFromOffset(offset);
    const nodePath = nodeManager.getPathFromNode(node);

    const connInfo = findConnectionInPath(nodePath);
    if (!connInfo) return null;

    const textCtx = getCompletionTextContext(textDocument, offset);
    const { currentWord, overwriteRange } = textCtx;

    let items: CompletionItem[] = [];

    if (connInfo.field === "key") {
      const names = await getConnectableParamNames(doc, connInfo.stepKey, this.toolRegistryService);
      items = names
        .filter((n) => n.startsWith(currentWord))
        .map((n) => ({
          label: n,
          kind: CompletionItemKind.Field,
          sortText: `_${n}`,
          insertText: `${n}: `,
          textEdit: { range: overwriteRange, newText: `${n}: ` },
        }));
    } else if (connInfo.field === "id") {
      const stepIds = getAvailableStepIds(doc, connInfo.stepKey);
      items = stepIds.map((id) => {
        const label = String(id);
        return {
          label,
          kind: CompletionItemKind.Value,
          sortText: `_${label.padStart(6, "0")}`,
          insertText: label,
          textEdit: { range: overwriteRange, newText: label },
        };
      });
    } else if (connInfo.field === "output_name") {
      // Find the sibling "id" field to know which step's outputs to suggest
      const sourceStepId = this.getSiblingId(doc, nodePath);
      if (sourceStepId !== undefined) {
        const outputNames = getStepOutputNames(doc, sourceStepId);
        items = outputNames
          .filter((n) => n.startsWith(currentWord))
          .map((n) => ({
            label: n,
            kind: CompletionItemKind.Value,
            sortText: `_${n}`,
            insertText: n,
            textEdit: { range: overwriteRange, newText: n },
          }));
      }
    }

    return { items, isIncomplete: false };
  }

  /**
   * Given a path ending at `["steps", stepKey, "input_connections", paramName, "output_name"]`,
   * find the sibling `id` field's integer value.
   */
  private getSiblingId(doc: NativeWorkflowDocument, path: NodePath): number | undefined {
    // Path is [..., "input_connections", paramName, "output_name"]
    // Navigate to the parent object (the connection entry) and read "id"
    const n = path.length;
    if (n < 2) return undefined;

    const parentPath = path.slice(0, n - 1); // [..., "input_connections", paramName]
    const root = doc.nodeManager.root;
    if (!root || root.type !== "object") return undefined;

    let current = root as ObjectASTNode;
    for (const seg of parentPath) {
      const prop = current.properties.find((p) => String(p.keyNode.value) === String(seg));
      if (!prop?.valueNode || prop.valueNode.type !== "object") return undefined;
      current = prop.valueNode as ObjectASTNode;
    }

    const idProp = current.properties.find((p) => p.keyNode.value === "id");
    if (!idProp?.valueNode || idProp.valueNode.type !== "number") return undefined;
    return Number(idProp.valueNode.value);
  }
}
