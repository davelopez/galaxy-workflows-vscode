import { PropertyASTNode } from "@gxwf/server-common/src/ast/types";
import {
  GetWorkflowInputsResult,
  GetWorkflowOutputsResult,
  TextDocument,
  WorkflowDataType,
  WorkflowDocument,
  WorkflowInput,
  WorkflowOutput,
} from "@gxwf/server-common/src/languageTypes";
import { YAMLDocument } from "@gxwf/yaml-language-service/src";

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
    return {
      inputs: this.getAllPropertyNodesAtPath("inputs").map((input) => this.parseInputDefinition(input)),
    };
  }

  public getWorkflowOutputs(): GetWorkflowOutputsResult {
    return {
      outputs: this.getAllPropertyNodesAtPath("outputs").map((output) => this.parseOutputDefinition(output)),
    };
  }

  private getAllPropertyNodesAtPath(path: string): PropertyASTNode[] {
    const result: PropertyASTNode[] = [];
    const nodeAtPath = this.nodeManager.getNodeFromPath(path);
    if (nodeAtPath?.type === "property") {
      const propertyNodes = nodeAtPath.valueNode?.children;
      if (propertyNodes) {
        propertyNodes.forEach((node) => {
          if (node.type !== "property" || !node.keyNode) return;
          result.push(node);
        });
      }
    }
    return result;
  }

  private parseInputDefinition(input: PropertyASTNode): WorkflowInput {
    const inputName = String(input.keyNode.value);
    const inputType = this.parseInputType(input);
    const inputDocNode = input.valueNode?.children?.find(
      (prop) => prop.type === "property" && prop.keyNode.value === "doc"
    ) as PropertyASTNode;
    const inputDescription = String(inputDocNode?.valueNode?.value ?? "");
    const inputDefinition: WorkflowInput = {
      name: inputName,
      doc: inputDescription,
      type: inputType,
      //TODO: default
    };
    return inputDefinition;
  }

  private parseInputType(input: PropertyASTNode): WorkflowDataType {
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

  private parseOutputDefinition(output: PropertyASTNode): WorkflowOutput {
    const outputName = String(output.keyNode.value);
    const outputDocNode = output.valueNode?.children?.find(
      (prop) => prop.type === "property" && prop.keyNode.value === "doc"
    ) as PropertyASTNode;
    const outputDoc = String(outputDocNode?.valueNode?.value ?? "");
    const outputDefinition = {
      name: outputName,
      doc: outputDoc,
    };
    return outputDefinition;
  }
}
