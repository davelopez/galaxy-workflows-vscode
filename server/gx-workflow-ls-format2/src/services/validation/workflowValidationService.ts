import {
  Diagnostic,
  DiagnosticSeverity,
  WorkflowDocument,
  WorkflowValidator,
} from "@gxwf/server-common/src/languageTypes";

export class WorkflowValidationService implements WorkflowValidator {
  public doValidation(workflowDocument: WorkflowDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [
      ...collectStepErrorDiagnostics(workflowDocument),
      ...collectToolDiagnostics(workflowDocument),
    ];
    return Promise.resolve(diagnostics);
  }
}

export function collectStepErrorDiagnostics(workflowDocument: WorkflowDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const steps = workflowDocument.nodeManager.getStepNodes();
  steps.forEach((step) => {
    const errors = step.properties.find((p) => p.keyNode.value === "errors");
    if (errors) {
      const range = workflowDocument.nodeManager.getNodeRange(errors);
      diagnostics.push(
        Diagnostic.create(
          range,
          `Tool step contains error indicated during Galaxy export - ${errors}`,
          DiagnosticSeverity.Warning
        )
      );
    }
  });
  return diagnostics;
}

export function collectToolDiagnostics(workflowDocument: WorkflowDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const steps = workflowDocument.nodeManager.getStepNodes();
  steps.forEach((step) => {
    const tool_id = step.properties.find((p) => p.keyNode.value === "tool_id");
    if (tool_id) {
      if (tool_id.valueNode?.value?.toString().includes("testtoolshed")) {
        const range = workflowDocument.nodeManager.getNodeRange(tool_id);
        diagnostics.push(
          Diagnostic.create(
            range,
            `Step references a tool from the test tool shed, this should be replaced with a production tool`,
            DiagnosticSeverity.Warning
          )
        );
      }
    }
  });
  return diagnostics;
}
