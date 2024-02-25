/* eslint-disable @typescript-eslint/no-namespace */
import { RequestType } from "vscode-languageserver";

// TODO: Move the contents of this file to a shared lib https://github.com/Microsoft/vscode/issues/15829

export namespace LSRequestIdentifiers {
  export const CLEAN_WORKFLOW_DOCUMENT = "galaxy-workflows-ls.cleanWorkflowDocument";
  export const CLEAN_WORKFLOW_CONTENTS = "galaxy-workflows-ls.cleanWorkflowContents";
  export const GET_WORKFLOW_INPUTS = "galaxy-workflows-ls.getWorkflowInputs";
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

export namespace CleanWorkflowDocumentRequest {
  export const type = new RequestType<CleanWorkflowDocumentParams, CleanWorkflowDocumentResult, void>(
    LSRequestIdentifiers.CLEAN_WORKFLOW_DOCUMENT
  );
}

export namespace CleanWorkflowContentsRequest {
  export const type = new RequestType<CleanWorkflowContentsParams, CleanWorkflowContentsResult, void>(
    LSRequestIdentifiers.CLEAN_WORKFLOW_CONTENTS
  );
}

export interface GetWorkflowInputsParams {
  uri: string;
}

export type WorkflowInputType = "data_input" | "data_collection_input";

export interface WorkflowInput {
  name: string;
  type: WorkflowInputType;
  description: string;
}

export interface GetWorkflowInputsResult {
  inputs: WorkflowInput[];
}
