import { RequestType } from "vscode-languageserver";

// TODO: Move the contents of this file to a shared lib https://github.com/Microsoft/vscode/issues/15829

export namespace LSRequestIdentifiers {
  export const CLEAN_WORKFLOW = "galaxy-workflows-ls.cleanWorkflow";
  export const CLEAN_WORKFLOW_CONTENTS = "galaxy-workflows-ls.cleanWorkflowContents";
}

export interface CleanWorkflowContentsParams {
  contents: string;
}

export interface CleanWorkflowDocumentParams {
  uri: string;
}

export interface CleanWorkflowDocument {
  contents: string;
}

export namespace CleanWorkflowDocumentRequest {
  export const type = new RequestType<CleanWorkflowDocumentParams, CleanWorkflowDocument, void>(
    LSRequestIdentifiers.CLEAN_WORKFLOW
  );
}

export namespace CleanWorkflowContentsRequest {
  export const type = new RequestType<CleanWorkflowContentsParams, CleanWorkflowDocument, void>(
    LSRequestIdentifiers.CLEAN_WORKFLOW_CONTENTS
  );
}
