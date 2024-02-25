import { GetWorkflowInputsResult } from "../services/requestsDefinitions";
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
}
