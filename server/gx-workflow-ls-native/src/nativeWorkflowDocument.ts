import { ASTNode, ParsedDocument } from "@gxwf/server-common/src/ast/types";
import { TextDocument, WorkflowDocument } from "@gxwf/server-common/src/languageTypes";
import { isWorkflowInputType } from "@gxwf/server-common/src/utils";
import { JSONDocument } from "vscode-json-languageservice";
import {
  GetWorkflowInputsResult,
  GetWorkflowOutputsResult,
  WorkflowDataType,
} from "../../../shared/src/requestsDefinitions";

/**
 * This class provides information about a Native workflow document structure.
 */
export class NativeWorkflowDocument extends WorkflowDocument {
  private _jsonDocument: JSONDocument;

  constructor(textDocument: TextDocument, jsonDocument: JSONDocument) {
    const parsedDocument: ParsedDocument = {
      ...{
        root: jsonDocument.root as ASTNode,
        getNodeFromOffset(offset: number) {
          return jsonDocument.getNodeFromOffset(offset) as ASTNode | undefined;
        },
      },
      internalDocument: jsonDocument,
    };
    super(textDocument, parsedDocument);
    this._jsonDocument = jsonDocument;
  }

  public get jsonDocument(): JSONDocument {
    return this._jsonDocument;
  }

  public getWorkflowInputs(): GetWorkflowInputsResult {
    const result: GetWorkflowInputsResult = { inputs: [] };
    const stepNodes = this.nodeManager.getStepNodes();
    stepNodes.forEach((step) => {
      const stepTypeNode = step.properties.find((property) => property.keyNode.value === "type");
      const stepTypeValue = String(stepTypeNode?.valueNode?.value);
      if (isWorkflowInputType(stepTypeValue)) {
        const labelNode = step.properties.find((property) => property.keyNode.value === "label");
        let labelValue = labelNode?.valueNode?.value;
        const annotationNode = step.properties.find((property) => property.keyNode.value === "annotation");
        let annotationValue = annotationNode?.valueNode?.value;
        if (!labelNode) {
          const inputs = step.properties.find((property) => property.keyNode.value === "inputs");
          if (inputs?.valueNode && inputs.valueNode.type === "array") {
            const input = inputs?.valueNode.items.at(0);
            if (input && input.type === "object") {
              labelValue = input.properties.find((p) => p.keyNode.value === "name")?.valueNode?.value ?? labelValue;
              annotationValue =
                input.properties.find((p) => p.keyNode.value === "description")?.valueNode?.value ?? annotationValue;
            }
          }
        }
        result.inputs.push({
          name: String(labelValue),
          doc: String(annotationValue ?? ""),
          type: this.getInputType(stepTypeValue),
        });
      }
    });
    return result;
  }

  /**
   * Returns the outputs of the workflow.
   */
  public getWorkflowOutputs(): GetWorkflowOutputsResult {
    const result: GetWorkflowOutputsResult = { outputs: [] };
    const stepNodes = this.nodeManager.getStepNodes();
    stepNodes.forEach((step) => {
      const workflowOutputsNode = step.properties.find((property) => property.keyNode.value === "workflow_outputs");
      if (workflowOutputsNode && workflowOutputsNode.valueNode?.type === "array") {
        const workflowOutputs = workflowOutputsNode.valueNode.items;
        workflowOutputs.forEach((workflowOutput) => {
          if (workflowOutput.type !== "object") {
            return;
          }
          const labelNode = workflowOutput.properties.find((property) => property.keyNode.value === "label");
          const labelValue = String(labelNode?.valueNode?.value);
          const uuidNode = workflowOutput.properties.find((property) => property.keyNode.value === "uuid");
          const uuidValue = String(uuidNode?.valueNode?.value);
          result.outputs.push({
            name: labelValue,
            uuid: uuidValue,
          });
        });
      }
    });
    return result;
  }

  private getInputType(typeName: string): WorkflowDataType {
    switch (typeName) {
      case "data_input":
        return "data";
      case "data_collection_input":
        return "collection";
      default:
        return "data";
    }
  }
}
