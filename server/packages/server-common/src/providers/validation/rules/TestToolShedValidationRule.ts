import { ValidationRule, WorkflowDocument } from "@gxwf/server-common/src/languageTypes";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";

/**
 * Validation rule to check if step nodes contain a reference to a tool from the test Tool Shed.
 */
export class TestToolshedValidationRule implements ValidationRule {
  constructor(readonly severity: DiagnosticSeverity = DiagnosticSeverity.Error) {}

  public async validate(workflowDocument: WorkflowDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const steps = workflowDocument.nodeManager.getStepNodes(true);
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
    return Promise.resolve(diagnostics);
  }
}
