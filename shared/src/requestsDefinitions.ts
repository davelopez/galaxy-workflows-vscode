/* eslint-disable @typescript-eslint/no-namespace */

export namespace LSRequestIdentifiers {
  export const CLEAN_WORKFLOW_DOCUMENT = "galaxy-workflows-ls.cleanWorkflowDocument";
  export const CLEAN_WORKFLOW_CONTENTS = "galaxy-workflows-ls.cleanWorkflowContents";
  export const GET_WORKFLOW_INPUTS = "galaxy-workflows-ls.getWorkflowInputs";
  export const GET_WORKFLOW_OUTPUTS = "galaxy-workflows-ls.getWorkflowOutputs";
}

export interface CleanWorkflowDocumentParams {
  uri: string;
}

export interface CleanWorkflowDocumentResult {
  error: string;
}

export interface CleanWorkflowContentsParams {
  contents: string;
}

export interface CleanWorkflowContentsResult {
  contents: string;
}

export interface TargetWorkflowDocumentParams {
  /** The URI of the target workflow document. */
  uri: string;
}

/**
 * This contains all the supported data types for workflow inputs.
 *
 * **Important**: This definition must be kept in sync with the schema definition.
 *
 * Note: Is defined as a const object to be used as a map and to be able to use the keys as a union type.
 * This way we can maintain a single source of truth for the supported data types and generate WorkflowDataType
 * type dynamically from it.
 */
export const workflowDataTypes = {
  boolean: true,
  collection: true,
  color: true, //TODO: this type seems to be missing in format2 schema
  data: true,
  double: true,
  File: true,
  float: true,
  int: true,
  integer: true,
  long: true,
  null: true,
  string: true,
  text: true,
} as const;

// Extract the keys of the object to form the union type
export type WorkflowDataType = keyof typeof workflowDataTypes;

export interface WorkflowInput {
  name: string;
  type: WorkflowDataType;
  doc: string;
  default?: unknown;
  optional?: boolean;
}

export interface GetWorkflowInputsResult {
  inputs: WorkflowInput[];
}

//TODO: unify format1 and format2 output definitions
export interface WorkflowOutput {
  name: string;
  uuid?: string;
  doc?: string;
  type?: WorkflowDataType;
}

export interface GetWorkflowOutputsResult {
  outputs: WorkflowOutput[];
}
