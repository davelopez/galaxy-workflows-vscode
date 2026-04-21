import { workflowDataTypes } from "../../../../shared/src/requestsDefinitions";
import { WorkflowDataType } from "./languageTypes";

export { isCompatibleType } from "@galaxy-tool-util/schema";

/**
 * Check if the type is a valid workflow data type.
 * @param type The type to check.
 * @returns True if the type is a valid workflow data type.
 */
export function isWorkflowDataType(type?: string): type is WorkflowDataType {
  if (!type) {
    return false;
  }
  return type in workflowDataTypes;
}

const SIMPLE_TYPES = ["number", "string", "boolean", "null"];

/**
 * Check if the type is a simple type (i.e. number, string, boolean or null).
 */
export function isSimpleType(type?: string): boolean {
  if (!type) {
    return false;
  }
  return SIMPLE_TYPES.includes(type);
}
