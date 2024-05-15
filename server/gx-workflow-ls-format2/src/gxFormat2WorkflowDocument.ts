import { PropertyASTNode } from "@gxwf/server-common/src/ast/types";
import { TextDocument, WorkflowDocument } from "@gxwf/server-common/src/languageTypes";
import { YAMLDocument } from "@gxwf/yaml-language-service/src";
import {
  GetWorkflowInputsResult,
  GetWorkflowOutputsResult,
  WorkflowDataType,
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
          const inputType = this.extractInputType(input);
          const inputDocNode = input.valueNode?.children?.find(
            (prop) => prop.type === "property" && prop.keyNode.value === "doc"
          ) as PropertyASTNode;
          const inputDescription = String(inputDocNode?.valueNode?.value ?? "");
          result.inputs.push({
            name: inputName,
            doc: inputDescription,
            type: inputType,
          });
        });
      }
    }
    return result;
  }

  public getWorkflowOutputs(): GetWorkflowOutputsResult {
    const result: GetWorkflowOutputsResult = { outputs: [] };
    const output = this.nodeManager.getNodeFromPath("outputs");
    if (output?.type === "property") {
      const outputList = output.valueNode?.children;
      if (outputList) {
        outputList.forEach((output) => {
          if (output.type !== "property" || !output.keyNode) return;
          const outputName = String(output.keyNode.value);
          const outputDocNode = output.valueNode?.children?.find(
            (prop) => prop.type === "property" && prop.keyNode.value === "doc"
          ) as PropertyASTNode;
          const outputDoc = String(outputDocNode?.valueNode?.value ?? "");
          result.outputs.push({
            name: outputName,
            doc: outputDoc,
          });
        });
      }
    }
    return result;
  }

  private extractInputType(input: PropertyASTNode): WorkflowDataType {
    let inputType: WorkflowDataType = "data";
    const inputTypeNode = input.valueNode?.children?.find(
      (prop) => prop.type === "property" && prop.keyNode.value === "type"
    ) as PropertyASTNode;
    if (inputTypeNode) {
      inputType = String(inputTypeNode.valueNode?.value) as WorkflowDataType;
    } else {
      // If the type property is not specified, it might be defined in the value node itself
      inputType = input.valueNode?.value as WorkflowDataType;
    }
    return inputType;
  }
}
