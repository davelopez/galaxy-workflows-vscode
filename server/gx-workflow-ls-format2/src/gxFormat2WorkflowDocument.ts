import { PropertyASTNode } from "@gxwf/server-common/src/ast/types";
import { TextDocument, WorkflowDocument } from "@gxwf/server-common/src/languageTypes";
import { YAMLDocument } from "@gxwf/yaml-language-service/src";
import {
  GetWorkflowInputsResult,
  GetWorkflowOutputsResult,
  WorkflowInputType,
} from "../../../shared/src/requestsDefinitions";

/**
 * This class provides information about a gxformat2 workflow document structure.
 */
export class GxFormat2WorkflowDocument extends WorkflowDocument {
  private _yamlDocument: YAMLDocument;
  constructor(textDocument: TextDocument, yamlDocument: YAMLDocument) {
    super(textDocument, yamlDocument);
    this._yamlDocument = yamlDocument;
  }

  public get yamlDocument(): YAMLDocument {
    return this._yamlDocument;
  }

  public getWorkflowInputs(): GetWorkflowInputsResult {
    const result: GetWorkflowInputsResult = { inputs: [] };
    const inputs = this.nodeManager.getNodeFromPath("inputs");
    if (inputs?.type === "property") {
      const inputList = inputs.valueNode?.children;
      if (inputList) {
        inputList.forEach((input) => {
          if (input.type !== "property" || !input.keyNode) return;
          const inputName = String(input.keyNode.value);
          const inputType = this.getInputType(input);
          const inputDocNode = input.valueNode?.children?.find(
            (prop) => prop.type === "property" && prop.keyNode.value === "doc"
          ) as PropertyASTNode;
          const inputDescription = String(inputDocNode?.valueNode?.value ?? "");
          result.inputs.push({
            name: inputName,
            description: inputDescription,
            type: inputType,
          });
        });
      }
    }
    return result;
  }

  public getWorkflowOutputs(): GetWorkflowOutputsResult {
    throw new Error("Method not implemented.");
  }

  private getInputType(input: PropertyASTNode): WorkflowInputType {
    let inputType: WorkflowInputType = "data";
    const inputTypeNode = input.valueNode?.children?.find(
      (prop) => prop.type === "property" && prop.keyNode.value === "type"
    ) as PropertyASTNode;
    if (inputTypeNode) {
      inputType = String(inputTypeNode.valueNode?.value) as WorkflowInputType;
    } else {
      // If the type property is not specified, it might be defined in the value node itself
      inputType = input.valueNode?.value as WorkflowInputType;
    }
    return inputType;
  }
}
