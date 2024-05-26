import { WorkflowDataType } from "@gxwf/server-common/src/languageTypes";

export function isWorkflowInputType(input: string): input is WorkflowDataType {
  return ["data_input", "data_collection_input", "parameter_input"].includes(input);
}

export interface ParameterInputToolState {
  parameter_type: string;
  optional: boolean;
}

export type ToolState = ParameterInputToolState | unknown;
