import type { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { astObjectNodeToRecord } from "@gxwf/server-common/src/providers/validation/toolStateAstHelpers";
import { runObjectStateValidationLoop } from "@gxwf/server-common/src/providers/validation/toolStateValidation";
import { validateFormat2StepStateStrict } from "@galaxy-tool-util/schema";
import { Diagnostic } from "vscode-languageserver-types";
import { GxFormat2WorkflowDocument } from "../gxFormat2WorkflowDocument";
import type { ToolParam } from "./toolStateTypes";

export class ToolStateValidationService {
  constructor(private readonly toolRegistryService: ToolRegistryService) {}

  async doValidation(documentContext: GxFormat2WorkflowDocument): Promise<Diagnostic[]> {
    return runObjectStateValidationLoop(
      documentContext.nodeManager,
      this.toolRegistryService,
      async (toolId, toolVersion, stateValueNode) => {
        const rawParams = await this.toolRegistryService.getToolParameters(toolId, toolVersion);
        if (!rawParams) return [];
        const stateDict = astObjectNodeToRecord(stateValueNode);
        return validateFormat2StepStateStrict(rawParams as ToolParam[], stateDict);
      }
    );
  }
}
