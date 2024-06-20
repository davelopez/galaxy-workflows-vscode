import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { DocumentContext, ValidationRule } from "../../../languageTypes";

export class RequiredArrayPropertyValidationRule implements ValidationRule {
  constructor(
    private propertyName: string,
    private valueRequired: boolean = true,
    private severity: DiagnosticSeverity = DiagnosticSeverity.Error,
    private message?: string
  ) {}

  public async validate(documentContext: DocumentContext): Promise<Diagnostic[]> {
    const result: Diagnostic[] = [];
    if (documentContext.nodeManager.root?.type !== "array") {
      return Promise.resolve(result);
    }
    for (const node of documentContext.nodeManager.root.items) {
      if (node.type !== "object") {
        continue;
      }
      const targetNode = node.properties.find((p) => p.keyNode.value === this.propertyName);
      if (!targetNode) {
        result.push({
          message: this.message ?? `Missing required property "${this.propertyName}".`,
          range: documentContext.nodeManager.getNodeRange(node),
          severity: this.severity,
        });
      }
      if (this.valueRequired && targetNode) {
        const missingValue = documentContext.nodeManager.isNodeEmpty(targetNode);
        if (missingValue) {
          result.push({
            message: `Missing required value in property "${this.propertyName}".`,
            range: documentContext.nodeManager.getNodeRange(targetNode),
            severity: this.severity,
          });
        }
      }
    }
    return Promise.resolve(result);
  }
}
