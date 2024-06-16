import { ValidationRule, WorkflowTestsDocument } from "@gxwf/server-common/src/languageTypes";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";

/**
 * Validation rule to check if the outputs defined in the test document are present in the associated workflow.
 */
export class WorkflowOutputsValidationRule implements ValidationRule {
  constructor(readonly severity: DiagnosticSeverity = DiagnosticSeverity.Error) {}

  public async validate(documentContext: WorkflowTestsDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const workflowOutputs = await documentContext.getWorkflowOutputs();
    const documentOutputNodes =
      documentContext.nodeManager.getAllPropertyNodesByName("outputs")[0]?.valueNode?.children ?? [];
    documentOutputNodes.forEach((outputNode) => {
      if (outputNode.type !== "property") {
        return;
      }
      const outputName = outputNode.keyNode.value as string;
      const output = workflowOutputs.find((o) => o.name === outputName);
      if (!output) {
        const range = documentContext.nodeManager.getNodeRange(outputNode);
        const message = `Output "${outputName}" is not defined in the associated workflow.`;
        diagnostics.push(Diagnostic.create(range, message, DiagnosticSeverity.Error));
      }
    });
    return Promise.resolve(diagnostics);
  }
}
