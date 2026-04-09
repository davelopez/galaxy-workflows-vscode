import type { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import {
  buildCacheMissDiagnostic,
  mapToolStateDiagnosticsToLSP,
} from "@gxwf/server-common/src/providers/validation/toolStateDiagnostics";
import {
  astObjectNodeToRecord,
  collectStepsWithObjectState,
  dotPathToAstRange,
} from "@gxwf/server-common/src/providers/validation/toolStateAstHelpers";
import { validateFormat2StepStateStrict } from "@galaxy-tool-util/schema";
import { Diagnostic } from "vscode-languageserver-types";
import { GxFormat2WorkflowDocument } from "../gxFormat2WorkflowDocument";
import type { ToolParam } from "./toolStateTypes";

export class ToolStateValidationService {
  constructor(private readonly toolRegistryService: ToolRegistryService) {}

  async doValidation(documentContext: GxFormat2WorkflowDocument): Promise<Diagnostic[]> {
    const result: Diagnostic[] = [];
    const nodeManager = documentContext.nodeManager;

    for (const { toolId, toolVersion, toolIdNode, stateValueNode } of collectStepsWithObjectState(nodeManager)) {
      if (!this.toolRegistryService.hasCached(toolId, toolVersion)) {
        result.push(
          buildCacheMissDiagnostic(
            toolId,
            this.toolRegistryService.hasResolutionFailed(toolId, toolVersion),
            nodeManager.getNodeRange(toolIdNode)
          )
        );
        continue;
      }

      const rawParams = await this.toolRegistryService.getToolParameters(toolId, toolVersion);
      if (!rawParams) continue;

      const stateDict = astObjectNodeToRecord(stateValueNode);
      const rawDiags = validateFormat2StepStateStrict(rawParams as ToolParam[], stateDict);
      const resolver = (path: string, target: "key" | "value") =>
        dotPathToAstRange(stateValueNode, path, nodeManager, target);
      result.push(...mapToolStateDiagnosticsToLSP(rawDiags, resolver));
    }

    return result;
  }
}
