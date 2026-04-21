/* eslint-disable @typescript-eslint/no-namespace */

export namespace LSNotificationIdentifiers {
  export const TOOL_RESOLUTION_FAILED = "galaxy-workflows-ls.toolResolutionFailed";
}

export namespace LSRequestIdentifiers {
  export const CLEAN_WORKFLOW_DOCUMENT = "galaxy-workflows-ls.cleanWorkflowDocument";
  export const CLEAN_WORKFLOW_CONTENTS = "galaxy-workflows-ls.cleanWorkflowContents";
  export const GET_WORKFLOW_INPUTS = "galaxy-workflows-ls.getWorkflowInputs";
  export const GET_WORKFLOW_OUTPUTS = "galaxy-workflows-ls.getWorkflowOutputs";
  export const GET_WORKFLOW_TOOL_IDS = "galaxy-workflows-ls.getWorkflowToolIds";
  export const POPULATE_TOOL_CACHE = "galaxy-workflows-ls.populateToolCache";
  export const GET_TOOL_CACHE_STATUS = "galaxy-workflows-ls.getToolCacheStatus";
  export const CONVERT_WORKFLOW_CONTENTS = "galaxy-workflows-ls.convertWorkflowContents";
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

// `string & {}` preserves autocomplete on the known union while accepting
// any string — mirrors `WorkflowDataType` in @galaxy-tool-util/schema.
export type WorkflowDataType = keyof typeof workflowDataTypes | (string & {});

export interface WorkflowInput {
  name: string;
  type: WorkflowDataType;
  doc?: string;
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

export interface ToolRef {
  toolId: string;
  toolVersion?: string;
}

export interface GetWorkflowToolIdsResult {
  tools: ToolRef[];
}

export interface PopulateToolCacheParams {
  tools: ToolRef[];
}

export interface PopulateToolCacheResult {
  fetched: number;
  alreadyCached: number;
  failed: Array<{ toolId: string; error: string }>;
}

export interface GetToolCacheStatusResult {
  cacheSize: number;
}

export interface ConvertWorkflowContentsParams {
  contents: string;
  targetFormat: "format2" | "native";
  /** When true, clean the workflow before converting. */
  clean?: boolean;
}

export interface ConvertWorkflowContentsResult {
  contents: string;
  error?: string;
}

export interface ToolResolutionFailedParams {
  failures: Array<{ toolId: string; error: string }>;
}
