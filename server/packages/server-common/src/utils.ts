import { WorkflowDataType } from "../../../../shared/src/requestsDefinitions";

export function isWorkflowInputType(input: string): input is WorkflowDataType {
  return input === "data_input" || input === "data_collection_input";
}
