import { DocumentContext, ValidationRule } from "@gxwf/server-common/src/languageTypes";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";

/**
 * Validation rule to check that all children of a node have a required property.
 */
export class ChildrenRequiredPropertyValidationRule implements ValidationRule {
  constructor(
    private nodePath: string,
    private propertyName: string,
    private valueRequired: boolean = true,
    private severity: DiagnosticSeverity = DiagnosticSeverity.Error,
    private message?: string
  ) {}

  public async validate(documentContext: DocumentContext): Promise<Diagnostic[]> {
    const result: Diagnostic[] = [];
    const targetNode = documentContext.nodeManager.getNodeFromPath(this.nodePath);
    if (!targetNode) {
      // The target node does not exist, so we can't check for children.
      return Promise.resolve(result);
    }

    const children = documentContext.nodeManager.getChildren(targetNode);
    for (const child of children) {
      if (child.type !== "object") {
        continue;
      }
      for (const childProperty of child.properties) {
        const targetChildNode = documentContext.nodeManager.getPropertyNodeByName(childProperty, this.propertyName);
        if (!targetChildNode) {
          result.push({
            message: this.message ?? `Missing required property "${this.propertyName}".`,
            range: documentContext.nodeManager.getNodeRange(childProperty.keyNode),
            severity: this.severity,
          });
        }

        if (this.valueRequired && targetChildNode) {
          const missingValue = documentContext.nodeManager.isNodeEmpty(targetChildNode);
          if (missingValue) {
            result.push({
              message: `Missing required value in property "${this.propertyName}".`,
              range: documentContext.nodeManager.getNodeRange(targetChildNode),
              severity: this.severity,
            });
          }
        }
      }
    }
    return Promise.resolve(result);
  }
}
