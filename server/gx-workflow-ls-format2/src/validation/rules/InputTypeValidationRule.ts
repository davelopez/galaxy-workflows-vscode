import { ValidationRule } from "@gxwf/server-common/src/languageTypes";
import { isCompatibleType, isWorkflowDataType } from "@gxwf/server-common/src/utils";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { GxFormat2WorkflowDocument } from "../../gxFormat2WorkflowDocument";

/**
 * Validation rule to check that all inputs that define a default value have the correct type.
 */
export class InputTypeValidationRule implements ValidationRule {
  constructor(readonly severity: DiagnosticSeverity = DiagnosticSeverity.Error) {}

  public async validate(documentContext: GxFormat2WorkflowDocument): Promise<Diagnostic[]> {
    const result: Diagnostic[] = [];

    const inputNodes = documentContext.getRawInputNodes();
    for (const input of inputNodes) {
      const inputName = String(input.keyNode.value);
      const inputType = documentContext.nodeManager.getPropertyValueByName(input, "type") as string;

      if (!isWorkflowDataType(inputType)) {
        // Skip type validation for invalid types. Those will be caught by the schema validation.
        continue;
      }

      const defaultValueNode = documentContext.nodeManager.getPropertyNodeByName(input, "default");
      const defaultValue = defaultValueNode?.valueNode?.value;
      const defaultValueType = typeof defaultValue;

      if (inputType && defaultValue) {
        const defaultTypeMatchesValue = isCompatibleType(inputType, defaultValueType);
        if (!defaultTypeMatchesValue) {
          result.push({
            message: `Input '${inputName}' default value has invalid type. Expected '${inputType}' but found '${defaultValueType}'.`,
            range: documentContext.nodeManager.getNodeRange(defaultValueNode),
            severity: this.severity,
          });
        }
      }
    }
    return Promise.resolve(result);
  }
}
