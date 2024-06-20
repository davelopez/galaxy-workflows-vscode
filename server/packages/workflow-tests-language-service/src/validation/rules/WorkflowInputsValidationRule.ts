import { PropertyASTNode } from "@gxwf/server-common/src/ast/types";
import { ValidationRule, WorkflowInput, WorkflowTestsDocument } from "@gxwf/server-common/src/languageTypes";
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
    const jobNodes = documentContext.nodeManager.getAllPropertyNodesByName("job");
    for (const jobNode of jobNodes) {
      const jobDiagnostics = await this.validateInputsInJobNode(jobNode, workflowInputs, documentContext);
      diagnostics.push(...jobDiagnostics);
    }
    return Promise.resolve(diagnostics);
  }

  private async validateInputsInJobNode(
    jobNode: PropertyASTNode,
    workflowInputs: WorkflowInput[],
    documentContext: WorkflowTestsDocument
  ): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    if (!jobNode) {
      // Skip validation if the job node is not present. This will be caught by schema validation.
      return Promise.resolve(diagnostics);
    }
    const documentInputNodes = jobNode?.valueNode?.children ?? [];
    const definedInputsInTestDocument = new Set<string>();
    for (const inputNode of documentInputNodes) {
      if (inputNode.type !== "property") {
        continue;
      }
      const inputName = inputNode.keyNode.value as string;
      definedInputsInTestDocument.add(inputName);
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
    const requiredWorkflowInputs = workflowInputs
      .filter((i) => !i.optional && i.default === undefined)
      .map((i) => i.name);
    const range = documentContext.nodeManager.getNodeRange(jobNode);
    for (const requiredInput of requiredWorkflowInputs) {
      if (!definedInputsInTestDocument.has(requiredInput)) {
        const message = `Input "${requiredInput}" is required but no value or default was provided.`;
        diagnostics.push(Diagnostic.create(range, message, DiagnosticSeverity.Error));
      }
    }
    return Promise.resolve(diagnostics);
  }
}
