/**
 * Shared validation loop for tool-state validation.
 *
 * Factors out the collect-steps → cache-check → validate → map-diagnostics
 * pattern common to both format2 and native (Pass A) validation services.
 */
import type { ToolStateDiagnostic } from "@galaxy-tool-util/schema";
import type { ToolRegistryService } from "../../languageTypes";
import type { ObjectASTNode } from "../../ast/types";
import { ASTNodeManager } from "../../ast/nodeManager";
import { Diagnostic } from "vscode-languageserver-types";
import { collectStepsWithObjectState, dotPathToAstRange } from "./toolStateAstHelpers";
import { buildCacheMissDiagnostic, mapToolStateDiagnosticsToLSP } from "./toolStateDiagnostics";

/**
 * Format-specific validation for a single step. Receives the tool ID, version,
 * object-valued state node, and the parent step node (for siblings such as
 * `input_connections`). Returns raw ToolStateDiagnostics.
 */
export type StepStateValidator = (
  toolId: string,
  toolVersion: string | undefined,
  stateValueNode: ObjectASTNode,
  stepNode: ObjectASTNode
) => Promise<ToolStateDiagnostic[]>;

/**
 * Shared outer loop used by both format2 and native (Pass A) validation services.
 *
 * For each step with an object-valued tool_state:
 *   1. Check the tool registry cache — emit a cache-miss diagnostic and skip if absent.
 *   2. Call `validator` to get raw ToolStateDiagnostic[] from the format-specific layer.
 *   3. Map raw diagnostics to LSP Diagnostics with AST-backed ranges.
 */
export async function runObjectStateValidationLoop(
  nodeManager: ASTNodeManager,
  registry: ToolRegistryService,
  validator: StepStateValidator
): Promise<Diagnostic[]> {
  const result: Diagnostic[] = [];

  for (const { toolId, toolVersion, toolIdNode, stateValueNode, stepNode } of collectStepsWithObjectState(nodeManager)) {
    if (!(await registry.hasCached(toolId, toolVersion))) {
      result.push(
        buildCacheMissDiagnostic(
          toolId,
          registry.hasResolutionFailed(toolId, toolVersion),
          nodeManager.getNodeRange(toolIdNode)
        )
      );
      continue;
    }

    const rawDiags = await validator(toolId, toolVersion, stateValueNode, stepNode);
    const resolver = (path: string, target: "key" | "value") =>
      dotPathToAstRange(stateValueNode, path, nodeManager, target);
    result.push(...mapToolStateDiagnosticsToLSP(rawDiags, resolver));
  }

  return result;
}
