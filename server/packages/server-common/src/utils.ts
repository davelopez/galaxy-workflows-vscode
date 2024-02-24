import { WorkflowInputType } from "./services/requestsDefinitions";

export function isWorkflowInputType(input: string): input is WorkflowInputType {
  return input === "data_input" || input === "data_collection_input";
}
