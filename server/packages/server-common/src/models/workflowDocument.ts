import { GetWorkflowInputsResult, GetWorkflowOutputsResult } from "../services/requestsDefinitions";
import { isWorkflowInputType } from "../utils";
import { DocumentBase } from "./document";

/**
 * This class abstracts the common logic of workflow documents.
 */
export abstract class WorkflowDocument extends DocumentBase {
  /**
   * Returns the inputs of the workflow.
   */
  public getWorkflowInputs(): GetWorkflowInputsResult {
    const result: GetWorkflowInputsResult = { inputs: [] };
    const stepNodes = this.nodeManager.getStepNodes();
    stepNodes.forEach((step) => {
      const stepTypeNode = step.properties.find((property) => property.keyNode.value === "type");
      const stepTypeValue = String(stepTypeNode?.valueNode?.value);
      if (isWorkflowInputType(stepTypeValue)) {
        const labelNode = step.properties.find((property) => property.keyNode.value === "label");
        const labelValue = String(labelNode?.valueNode?.value);
        const annotationNode = step.properties.find((property) => property.keyNode.value === "annotation");
        const annotationValue = String(annotationNode?.valueNode?.value);
        result.inputs.push({
          name: labelValue ?? "UNKNOWN",
          description: annotationValue,
          type: stepTypeValue,
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
          const outputNameNode = workflowOutput.properties.find((property) => property.keyNode.value === "output_name");
          const outputNameValue = String(outputNameNode?.valueNode?.value);
          const uuidNode = workflowOutput.properties.find((property) => property.keyNode.value === "uuid");
          const uuidValue = String(uuidNode?.valueNode?.value);
          result.outputs.push({
            label: labelValue ?? "UNKNOWN",
            output_name: outputNameValue,
            uuid: uuidValue,
          });
        });
      }
    });
    return result;
  }
}
