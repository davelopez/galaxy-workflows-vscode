import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { ValidationRule, WorkflowDocument } from "../../languageTypes";

/**
 * Validation rule to check that a particular property exists in a workflow.
 * The property can be specified by a path, i.e: "prop1/prop2" will check
 * that 'prop1' contains a 'prop2' property defined.
 */
export class MissingPropertyValidationRule implements ValidationRule {
  constructor(readonly nodePath: string, readonly severity?: DiagnosticSeverity | undefined) {}

  validate(workflowDocument: WorkflowDocument): Promise<Diagnostic[]> {
    const result: Diagnostic[] = [];
    const targetNode = workflowDocument.nodeManager.getNodeFromPath(this.nodePath);
    if (!targetNode) {
      result.push({
        message: `Missing property "${this.nodePath}".`,
        range: workflowDocument.nodeManager.getDefaultRange(),
        severity: this.severity,
      });
    }
    return Promise.resolve(result);
  }
}
