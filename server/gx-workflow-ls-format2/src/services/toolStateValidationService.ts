import type { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { astObjectNodeToRecord } from "@gxwf/server-common/src/providers/validation/toolStateAstHelpers";
import { runObjectStateValidationLoop } from "@gxwf/server-common/src/providers/validation/toolStateValidation";
import { nativeConnectionsFromFormat2In, validateFormat2StepStateStrict } from "@galaxy-tool-util/schema";
import { Diagnostic } from "vscode-languageserver-types";
import { GxFormat2WorkflowDocument } from "../gxFormat2WorkflowDocument";
import type { ToolParam } from "./toolStateTypes";
import { getFormat2StepInputs } from "./workflowConnectionService";

export class ToolStateValidationService {
  constructor(private readonly toolRegistryService: ToolRegistryService) {}

  async doValidation(documentContext: GxFormat2WorkflowDocument): Promise<Diagnostic[]> {
    return runObjectStateValidationLoop(
      documentContext.nodeManager,
      this.toolRegistryService,
      async (toolId, toolVersion, stateValueNode, stepNode, stateKey) => {
        const stateDict = astObjectNodeToRecord(stateValueNode);
        // Pick the validator by state shape, not workflow format (mirrors gxformat2's
        // state_encode_to_format2 contract): a raw native `tool_state` block keeps the
        // native encoding (inline ConnectedValue/RuntimeValue markers, double-encoded
        // scalars), so it must validate against the native model. A schema-aware `state`
        // block validates against the format2 model.
        if (stateKey === "tool_state") {
          // A required param connected via the format2 `in:` block has no inline value
          // in the native tool_state; tell the validator about those connections so it
          // doesn't flag them as missing.
          const connections = nativeConnectionsFromFormat2In(getFormat2StepInputs(stepNode));
          return this.toolRegistryService.validateNativeStep(toolId, toolVersion, stateDict, connections);
        }
        const rawParams = await this.toolRegistryService.getToolParameters(toolId, toolVersion);
        if (!rawParams) return [];
        return validateFormat2StepStateStrict(rawParams as ToolParam[], stateDict);
      }
    );
  }
}
