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
