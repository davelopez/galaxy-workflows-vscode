import { validateFormat2StepStateStrict } from "@galaxy-tool-util/schema";
import { ASTNode, ArrayASTNode, ObjectASTNode } from "@gxwf/server-common/src/ast/types";
import { ASTNodeManager } from "@gxwf/server-common/src/ast/nodeManager";
import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver-types";
import { GxFormat2WorkflowDocument } from "../gxFormat2WorkflowDocument";
import { ToolParam, collectStepsWithState, dotPathToYamlProperty, yamlObjectNodeToRecord } from "./toolStateTypes";

// ---------------------------------------------------------------------------
// Path → YAML range helper
// ---------------------------------------------------------------------------

/**
 * Walk a dot-separated path through a YAML ObjectASTNode tree and return
 * the range of the final property's key (for unknown-key diagnostics) or
 * value node (for value-error diagnostics). Falls back to the state node
 * range when navigation fails.
 *
 * Handles numeric array indices as intermediate segments. For a numeric
 * final segment (e.g. a bare repeat-item index) the item node range is returned.
 */
function dotPathToYamlRange(
  stateNode: ObjectASTNode,
  dotPath: string,
  nodeManager: ASTNodeManager,
  target: "key" | "value" = "key"
): Range {
  if (!dotPath) return nodeManager.getNodeRange(stateNode);

  // Fast path for the common (non-array-index-at-end) case.
  const prop = dotPathToYamlProperty(stateNode, dotPath);
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
      const found = (current as ObjectASTNode).properties.find(
        (p) => String(p.keyNode.value) === segments[i]
      );
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
// Diagnostic post-processing
// ---------------------------------------------------------------------------

/**
 * Convert raw ToolStateDiagnostic[] from the upstream strict validator into LSP
 * Diagnostic[].
 *
 * Two transformations are applied:
 *   - Excess-property diagnostics (message contains "is unexpected"): remapped
 *     to "Unknown tool parameter '...'" with Warning severity and the key node
 *     highlighted.
 *   - Value-error diagnostics: Effect Schema emits one issue per union member for
 *     invalid literals, so we group by path and merge them into a single
 *     "Invalid value '...' for '...'. Must be one of: ..." Error.
 */
function mapDiagnostics(
  rawDiags: ReturnType<typeof validateFormat2StepStateStrict>,
  stateNode: ObjectASTNode,
  nodeManager: ASTNodeManager
): Diagnostic[] {
  // Group by path so we can merge multi-issue union errors.
  const groups = new Map<string, typeof rawDiags>();
  for (const d of rawDiags) {
    const bucket = groups.get(d.path) ?? [];
    bucket.push(d);
    groups.set(d.path, bucket);
  }

  const result: Diagnostic[] = [];
  for (const [path, diags] of groups) {
    if (diags.some((d) => d.message.includes("is unexpected"))) {
      // Excess property — emit a Warning pointing at the unknown key.
      const leafKey = path.split(".").at(-1) ?? path;
      result.push({
        message: `Unknown tool parameter '${leafKey}'.`,
        range: dotPathToYamlRange(stateNode, path, nodeManager, "key"),
        severity: DiagnosticSeverity.Warning,
      });
    } else {
      // Value error — try to format as "Invalid value '...' for '...'. Must be one of: ..."
      // Effect emits 'Expected "a", actual "b"' per union member; collect all expected
      // literal values (skip "undefined" from optional wrapping).
      const expectedValues: string[] = [];
      let actualValue: string | undefined;
      for (const d of diags) {
        const expMatch = d.message.match(/Expected "([^"]+)"/);
        if (expMatch && expMatch[1] !== "undefined") expectedValues.push(expMatch[1]);
        if (!actualValue) {
          const actMatch = d.message.match(/actual "([^"]+)"/);
          if (actMatch) actualValue = actMatch[1];
        }
      }

      const paramName = path.split(".").at(-1) ?? path;
      const message =
        actualValue && expectedValues.length > 0
          ? `Invalid value '${actualValue}' for '${paramName}'. Must be one of: ${expectedValues.join(", ")}.`
          : diags[0].message;

      result.push({
        message,
        range: dotPathToYamlRange(stateNode, path, nodeManager, "value"),
        severity: DiagnosticSeverity.Error,
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// ToolStateValidationService
// ---------------------------------------------------------------------------

export class ToolStateValidationService {
  constructor(private readonly toolRegistryService: ToolRegistryService) {}

  async doValidation(documentContext: GxFormat2WorkflowDocument): Promise<Diagnostic[]> {
    const result: Diagnostic[] = [];
    const nodeManager = documentContext.nodeManager;

    for (const { toolId, toolVersion, toolIdNode, stateValueNode } of collectStepsWithState(nodeManager)) {
      if (!this.toolRegistryService.hasCached(toolId, toolVersion)) {
        result.push({
          message: `Tool '${toolId}' is not in the local cache. Run 'Populate Tool Cache' to enable tool state validation.`,
          range: nodeManager.getNodeRange(toolIdNode),
          severity: DiagnosticSeverity.Information,
        });
        continue;
      }

      const rawParams = await this.toolRegistryService.getToolParameters(toolId, toolVersion);
      if (!rawParams) continue;

      const stateDict = yamlObjectNodeToRecord(stateValueNode);
      const rawDiags = validateFormat2StepStateStrict(rawParams as ToolParam[], stateDict);
      result.push(...mapDiagnostics(rawDiags, stateValueNode, nodeManager));
    }

    return result;
  }
}
