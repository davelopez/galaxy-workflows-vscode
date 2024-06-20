import { ValidationRule, WorkflowTestsDocument } from "@gxwf/server-common/src/languageTypes";
import { isCompatibleType } from "@gxwf/server-common/src/utils";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";

/**
 * Validation rule to check if the inputs defined in the test document are present in the associated workflow.
 */
export class WorkflowInputsValidationRule implements ValidationRule {
  constructor(readonly severity: DiagnosticSeverity = DiagnosticSeverity.Error) {}

  public async validate(documentContext: WorkflowTestsDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const workflowInputs = await documentContext.getWorkflowInputs();
    const documentInputNodes =
      documentContext.nodeManager.getAllPropertyNodesByName("job")[0]?.valueNode?.children ?? [];
    for (const inputNode of documentInputNodes) {
      if (inputNode.type !== "property") {
        continue;
      }
      const inputName = inputNode.keyNode.value as string;
      const input = workflowInputs.find((i) => i.name === inputName);
      if (!input) {
        const range = documentContext.nodeManager.getNodeRange(inputNode);
        const message = `Input "${inputName}" is not defined in the associated workflow.`;
        diagnostics.push(Diagnostic.create(range, message, DiagnosticSeverity.Error));
      } else {
        if (inputNode.valueNode) {
          const inputType = input.type;
          const inputTypeValue = inputNode.valueNode.type;
          if (!isCompatibleType(inputType, inputTypeValue)) {
            const range = documentContext.nodeManager.getNodeRange(inputNode);
            const message = `Input "${inputName}" has an invalid type. Expected "${inputType}" but found "${inputTypeValue}".`;
            diagnostics.push(Diagnostic.create(range, message, DiagnosticSeverity.Error));
          }
        }
      }
    }
    return Promise.resolve(diagnostics);
  }
}
