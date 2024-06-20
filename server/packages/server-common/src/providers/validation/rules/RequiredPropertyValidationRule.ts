import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { DocumentContext, ValidationRule } from "../../../languageTypes";

/**
 * Validation rule to check that a particular property exists in a workflow.
 * The property can be specified by a path, i.e: "prop1/prop2" will check
 * that 'prop1' contains a 'prop2' property defined.
 *
 * By default, the rule will also check that the property has a value, but this
 * can be disabled by setting the `valueRequired` parameter to `false`. If the
 * property is an object or an array, the rule will also check that it has at
 * least one property or item.
 */
export class RequiredPropertyValidationRule implements ValidationRule {
  constructor(
    private nodePath: string,
    private valueRequired: boolean = true,
    private severity: DiagnosticSeverity = DiagnosticSeverity.Error,
    private message?: string
  ) {}

  public async validate(documentContext: DocumentContext): Promise<Diagnostic[]> {
    const result: Diagnostic[] = [];
    const targetNode = documentContext.nodeManager.getNodeFromPath(this.nodePath);
    if (!targetNode) {
      result.push({
        message: this.message ?? `Missing required property "${this.nodePath}".`,
        range: documentContext.nodeManager.getDefaultRange(),
        severity: this.severity,
      });
    }

    if (this.valueRequired && targetNode) {
      const missingValue = documentContext.nodeManager.isNodeEmpty(targetNode);
      if (missingValue) {
        result.push({
          message: `Missing required value in property "${this.nodePath}".`,
          range: documentContext.nodeManager.getNodeRange(targetNode),
          severity: this.severity,
        });
      }
    }
    return Promise.resolve(result);
  }
}
