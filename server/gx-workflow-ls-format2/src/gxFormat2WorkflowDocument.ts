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
      inputs: this.getRawInputNodes().map((input) => this.parseInputDefinition(input)),
    };
  }

  public getWorkflowOutputs(): GetWorkflowOutputsResult {
    return {
      outputs: this.getRawOutputNodes().map((output) => this.parseOutputDefinition(output)),
    };
  }

  public getRawInputNodes(): PropertyASTNode[] {
    return this.getAllPropertyNodesAtPath("inputs");
  }

  public getRawOutputNodes(): PropertyASTNode[] {
    return this.getAllPropertyNodesAtPath("outputs");
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
    const inputDocNode = this.nodeManager.getPropertyNodeByName(input, "doc");
    const inputDescription = String(inputDocNode?.valueNode?.value ?? "");
    const defaultValueNode = this.nodeManager.getPropertyNodeByName(input, "default");
    const optionalValue = this.nodeManager.getPropertyValueByName(input, "optional");
    const inputDefinition: WorkflowInput = {
      name: inputName,
      doc: inputDescription,
      type: inputType,
      default: defaultValueNode?.valueNode?.value,
      optional: optionalValue === undefined ? undefined : optionalValue === true,
    };
    return inputDefinition;
  }

  private parseInputType(input: PropertyASTNode): WorkflowDataType {
    let inputType: WorkflowDataType = "data";
    const inputTypeNode = this.nodeManager.getPropertyNodeByName(input, "type");
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
    const outputDocNode = this.nodeManager.getPropertyNodeByName(output, "doc");
    const outputDoc = String(outputDocNode?.valueNode?.value ?? "");
    const outputDefinition = {
      name: outputName,
      doc: outputDoc,
    };
    return outputDefinition;
  }
}
