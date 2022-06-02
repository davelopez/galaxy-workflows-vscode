import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { ValidationRule, WorkflowDocument } from "../../languageTypes";

export class MissingPropertyValidationRule implements ValidationRule {
  constructor(readonly nodePath: string, readonly severity?: DiagnosticSeverity | undefined) {}

  validate(workflowDocument: WorkflowDocument): Promise<Diagnostic[]> {
    const result: Diagnostic[] = [];
    const targetNode = workflowDocument.getNodeFromPath(this.nodePath);
    if (!targetNode) {
      result.push({
        message: `Property '${this.nodePath}' is missing`,
        range: workflowDocument.getDefaultRange(),
        severity: this.severity,
      });
    }
    return Promise.resolve(result);
  }
}
