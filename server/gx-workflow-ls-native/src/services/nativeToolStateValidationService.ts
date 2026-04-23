import type { ASTNode, ObjectASTNode, StringASTNode } from "@gxwf/server-common/src/ast/types";
import { ASTNodeManager } from "@gxwf/server-common/src/ast/nodeManager";
import type { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import {
  LEGACY_TOOL_STATE_CODE,
  buildCacheMissDiagnostic,
  buildLegacyToolStateHintDiagnostic,
  mapToolStateDiagnosticsToLSP,
} from "@gxwf/server-common/src/providers/validation/toolStateDiagnostics";
import { astObjectNodeToRecord } from "@gxwf/server-common/src/providers/validation/toolStateAstHelpers";
import { runObjectStateValidationLoop } from "@gxwf/server-common/src/providers/validation/toolStateValidation";
import { Diagnostic } from "vscode-languageserver-types";
import { NativeWorkflowDocument } from "../nativeWorkflowDocument";

// ---------------------------------------------------------------------------
// String-encoded tool_state helper (Pass B — legacy / pre-clean)
// ---------------------------------------------------------------------------

interface NativeStringStateContext {
  toolId: string;
  toolVersion?: string;
  toolIdNode: ASTNode;
  toolStateStringNode: StringASTNode;
  toolStateParsed: Record<string, unknown>;
  inputConnections?: Record<string, unknown>;
}

/**
 * Collect steps where `tool_state` is a JSON-encoded string (pre-clean).
 * Object-valued `tool_state` steps are handled by `collectStepsWithObjectState`.
 */
function collectNativeStepsWithStringState(nodeManager: ASTNodeManager): NativeStringStateContext[] {
  const result: NativeStringStateContext[] = [];
  for (const stepNode of nodeManager.getStepNodes()) {
    const toolIdProp = stepNode.properties.find((p) => p.keyNode.value === "tool_id");
    const toolId = toolIdProp?.valueNode?.type === "string" ? String(toolIdProp.valueNode.value) : undefined;
    if (!toolId || !toolIdProp?.valueNode) continue;

    const toolVersionProp = stepNode.properties.find((p) => p.keyNode.value === "tool_version");
    const toolVersion =
      toolVersionProp?.valueNode?.type === "string" ? String(toolVersionProp.valueNode.value) : undefined;

    const stateProp = stepNode.properties.find((p) => p.keyNode.value === "tool_state");
    if (!stateProp?.valueNode || stateProp.valueNode.type !== "string") continue;

    const toolStateString = String((stateProp.valueNode as StringASTNode).value);
    let toolStateParsed: Record<string, unknown>;
    try {
      toolStateParsed = JSON.parse(toolStateString) as Record<string, unknown>;
    } catch {
      continue; // silently skip malformed JSON
    }

    const inputConnectionsProp = stepNode.properties.find((p) => p.keyNode.value === "input_connections");
    const inputConnections =
      inputConnectionsProp?.valueNode?.type === "object"
        ? astObjectNodeToRecord(inputConnectionsProp.valueNode as ObjectASTNode)
        : undefined;

    result.push({
      toolId,
      toolVersion,
      toolIdNode: toolIdProp.valueNode,
      toolStateStringNode: stateProp.valueNode as StringASTNode,
      toolStateParsed,
      inputConnections,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// NativeToolStateValidationService
// ---------------------------------------------------------------------------

export class NativeToolStateValidationService {
  constructor(private readonly toolRegistryService: ToolRegistryService) {}

  async doValidation(documentContext: NativeWorkflowDocument): Promise<Diagnostic[]> {
    const nodeManager = documentContext.nodeManager;

    // Pass A — object-valued tool_state (post-clean)
    const result = await runObjectStateValidationLoop(
      nodeManager,
      this.toolRegistryService,
      async (toolId, toolVersion, stateValueNode, stepNode) => {
        const toolState = astObjectNodeToRecord(stateValueNode);
        const inputConnectionsProp = stepNode.properties.find((p) => p.keyNode.value === "input_connections");
        const inputConnections =
          inputConnectionsProp?.valueNode?.type === "object"
            ? astObjectNodeToRecord(inputConnectionsProp.valueNode as ObjectASTNode)
            : undefined;
        return this.toolRegistryService.validateNativeStep(toolId, toolVersion, toolState, inputConnections);
      }
    );

    // Pass B — string-valued tool_state (pre-clean / legacy)
    for (const {
      toolId,
      toolVersion,
      toolIdNode,
      toolStateStringNode,
      toolStateParsed,
      inputConnections,
    } of collectNativeStepsWithStringState(nodeManager)) {
      if (!(await this.toolRegistryService.hasCached(toolId, toolVersion))) {
        result.push(
          buildCacheMissDiagnostic(
            toolId,
            this.toolRegistryService.hasResolutionFailed(toolId, toolVersion),
            nodeManager.getNodeRange(toolIdNode)
          )
        );
        continue;
      }

      const rawDiags = await this.toolRegistryService.validateNativeStep(
        toolId,
        toolVersion,
        toolStateParsed,
        inputConnections
      );
      // Flat resolver: all diagnostics for a string-encoded tool_state point at the whole string.
      const stringRange = nodeManager.getNodeRange(toolStateStringNode);
      const passBDiags = mapToolStateDiagnosticsToLSP(rawDiags, () => stringRange).map((d) => ({
        ...d,
        code: LEGACY_TOOL_STATE_CODE,
      }));
      result.push(...passBDiags);
      // Always emit a hint so the "Clean workflow" quick fix is discoverable even when
      // there are no param validation errors.
      result.push(buildLegacyToolStateHintDiagnostic(stringRange));
    }

    return result;
  }
}
