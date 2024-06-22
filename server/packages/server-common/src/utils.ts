import { workflowDataTypes } from "../../../../shared/src/requestsDefinitions";
import { WorkflowDataType } from "./languageTypes";

/**
 * Check if the actual type can be mapped to the expected type.
 * Usefull to validate properties types.
 * @param expectedType The expected type. Usually a type supported by the schema.
 * @param actualType The actual type. You can use the `typeof` operator to get this value.
 */
export function isCompatibleType(expectedType: WorkflowDataType, actualType: string): boolean {
  let isCompatible = true;
  switch (expectedType) {
    case "int":
    case "integer":
    case "long":
    case "double":
    case "float":
      isCompatible = actualType === "number";
      break;
    case "boolean":
      isCompatible = actualType === "boolean";
      break;
    case "text":
    case "string":
      isCompatible = actualType === "string";
      break;
    case "File":
      isCompatible = actualType === "string" || actualType === "object";
      break;
    case "null":
      isCompatible = actualType === null;
      break;
  }
  return isCompatible;
}

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
