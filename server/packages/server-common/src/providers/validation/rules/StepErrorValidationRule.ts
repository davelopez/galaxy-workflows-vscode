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
    for (const step of steps) {
      const errors = step.properties.find((p) => p.keyNode.value === "errors");
      if (errors && errors.valueNode && errors.valueNode.type !== "null") {
        const range = documentContext.nodeManager.getNodeRange(errors);
        const valueRange = documentContext.nodeManager.getNodeRange(errors.valueNode);
        const errorValue = documentContext.textDocument.getText(valueRange);
        diagnostics.push(
          Diagnostic.create(
            range,
            `Tool step contains error indicated during Galaxy export - ${errorValue}`,
            this.severity
          )
        );
      }
    }
    return Promise.resolve(diagnostics);
  }
}
