import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { ValidationRule, WorkflowDocument } from "../../languageTypes";

/**
 * Validation rule to check that all defined `workflow_outputs` have a `label`.
 */
export class WorkflowOutputLabelValidation implements ValidationRule {
  constructor(readonly severity: DiagnosticSeverity = DiagnosticSeverity.Error) {}

  validate(workflowDocument: WorkflowDocument): Promise<Diagnostic[]> {
    const result: Diagnostic[] = [];
    const stepNodes = workflowDocument.nodeManager.getStepNodes();
    stepNodes.forEach((step) => {
      const workflowOutputs = step.properties.find((property) => property.keyNode.value === "workflow_outputs");
      if (workflowOutputs && workflowOutputs.valueNode && workflowOutputs.valueNode.type === "array") {
        workflowOutputs.valueNode.items.forEach((outputNode) => {
          if (outputNode.type === "object") {
            const labelNode = outputNode.properties.find((property) => property.keyNode.value === "label");
            if (!labelNode?.valueNode?.value) {
              result.push({
                message: `Missing label in workflow output.`,
                range: workflowDocument.nodeManager.getNodeRange(outputNode),
                severity: this.severity,
              });
            }
          }
        });
      }
    });
    return Promise.resolve(result);
  }
}
