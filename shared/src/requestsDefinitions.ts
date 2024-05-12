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

export type WorkflowInputType =
  | "null"
  | "boolean"
  | "int"
  | "long"
  | "float"
  | "double"
  | "string"
  | "integer"
  | "text"
  | "File"
  | "data"
  | "collection";

export interface WorkflowInput {
  name: string;
  type: WorkflowInputType;
  description: string;
}

export interface GetWorkflowInputsResult {
  inputs: WorkflowInput[];
}

export interface WorkflowOutput {
  label: string;
  output_name: string;
  uuid: string;
}

export interface GetWorkflowOutputsResult {
  outputs: WorkflowOutput[];
}
