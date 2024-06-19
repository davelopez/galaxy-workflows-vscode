import { ValidationRule } from "@gxwf/server-common/src/languageTypes";
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
    inputNodes.forEach((input) => {
      let defaultTypeMatchesValue = true;

      const inputName = String(input.keyNode.value);
      const inputTypeValue = documentContext.nodeManager.getPropertyValueByName(input, "type");
      const defaultValueNode = documentContext.nodeManager.getPropertyNodeByName(input, "default");
      const defaultValue = defaultValueNode.valueNode?.value;

      const defaultValueType = typeof defaultValue;
      if (inputTypeValue && defaultValue) {
        switch (inputTypeValue) {
          case "int":
          case "integer":
          case "long":
          case "double":
          case "float":
            defaultTypeMatchesValue = defaultValueType === "number";
            break;
          case "boolean":
            defaultTypeMatchesValue = defaultValueType === "boolean";
            break;
          case "string":
            defaultTypeMatchesValue = defaultValueType === "string";
            break;
          case "null":
            defaultTypeMatchesValue = defaultValueType === null;
            break;
        }
        if (!defaultTypeMatchesValue) {
          result.push({
            message: `Input '${inputName}' default value has invalid type. Expected '${inputTypeValue}' but found '${defaultValueType}'.`,
            range: documentContext.nodeManager.getNodeRange(defaultValueNode),
            severity: this.severity,
          });
        }
      }
    });

    return Promise.resolve(result);
  }
}
