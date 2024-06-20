import { DocumentContext, ValidationRule } from "@gxwf/server-common/src/languageTypes";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";

/**
 * Validation rule to check if step nodes contain export errors.
 */
export class StepExportErrorValidationRule implements ValidationRule {
  constructor(readonly severity: DiagnosticSeverity = DiagnosticSeverity.Error) {}

  public async validate(documentContext: DocumentContext): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const steps = documentContext.nodeManager.getStepNodes(true);
    steps.forEach((step) => {
      const errors = step.properties.find((p) => p.keyNode.value === "errors");
      if (errors) {
        const range = documentContext.nodeManager.getNodeRange(errors);
        diagnostics.push(
          Diagnostic.create(
            range,
            `Tool step contains error indicated during Galaxy export - ${errors}`,
            DiagnosticSeverity.Warning
          )
        );
      }
    });
    return Promise.resolve(diagnostics);
  }
}
