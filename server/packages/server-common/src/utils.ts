import { WorkflowInputType } from "../../../../shared/src/requestsDefinitions";

export function isWorkflowInputType(input: string): input is WorkflowInputType {
  return input === "data_input" || input === "data_collection_input";
}
