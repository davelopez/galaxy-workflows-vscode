import { RequestType } from "vscode-languageclient";

// TODO: Move the contents of this file to a shared lib https://github.com/Microsoft/vscode/issues/15829

export namespace LSRequestIdentifiers {
  export const CLEAN_WORKFLOW_CONTENTS = "galaxy-workflows-ls.cleanWorkflowContents";
}

export interface CleanWorkflowContentsParams {
  contents: string;
}

export interface CleanWorkflowContentsResult {
  contents: string;
}

export namespace CleanWorkflowContentsRequest {
  export const type = new RequestType<CleanWorkflowContentsParams, CleanWorkflowContentsResult, void>(
    LSRequestIdentifiers.CLEAN_WORKFLOW_CONTENTS
  );
}
