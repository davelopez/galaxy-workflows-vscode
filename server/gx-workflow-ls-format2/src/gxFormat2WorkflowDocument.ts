import { PropertyASTNode } from "@gxwf/server-common/src/ast/types";
import { TextDocument, WorkflowDocument } from "@gxwf/server-common/src/languageTypes";
import { YAMLDocument } from "@gxwf/yaml-language-service/src";
import { GetWorkflowInputsResult, GetWorkflowOutputsResult } from "../../../shared/src/requestsDefinitions";

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
          const inputTypeNode = input.valueNode?.children?.find(
            (prop) => prop.type === "property" && prop.keyNode.value === "type"
          ) as PropertyASTNode;
          const inputType =
            !inputTypeNode || inputTypeNode.valueNode?.value === "File" ? "data_input" : "data_collection_input";
          const inputDocNode = input.valueNode?.children?.find(
            (prop) => prop.type === "property" && prop.keyNode.value === "doc"
          ) as PropertyASTNode;
          const inputDescription = String(inputDocNode?.valueNode?.value ?? "");
          if (inputType) {
            result.inputs.push({
              name: inputName,
              description: inputDescription,
              type: inputType,
            });
          }
        });
      }
    }
    return result;
  }

  public getWorkflowOutputs(): GetWorkflowOutputsResult {
    throw new Error("Method not implemented.");
  }
}
