import { RequestType } from "vscode-languageserver";
import { WorkflowDocument } from "../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../server";
import { CustomCommand, LSRequestIdentifiers } from "./common";

export interface CleanWorkflowDocumentParams {
  uri: string;
}

export interface CleanWorkflowDocument {
  contents: string;
}

//TODO move this to a common lib
export namespace CleanWorkflowDocumentRequest {
  export const type = new RequestType<CleanWorkflowDocumentParams, CleanWorkflowDocument, void>(
    LSRequestIdentifiers.CLEAN_WORKFLOW
  );
}

export class CleanWorkflowCommand extends CustomCommand {
  public static register(server: GalaxyWorkflowLanguageServer): CleanWorkflowCommand {
    return new CleanWorkflowCommand(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
  }

  protected listenToRequests(): void {
    this.connection.onRequest(CleanWorkflowDocumentRequest.type, async (params) => {
      const workflowDocument = this.workflowDocuments.get(params.uri);
      if (workflowDocument) {
        return await this.cleanWorkflowDocument(workflowDocument);
      }
      return undefined;
    });
  }

  private async cleanWorkflowDocument(workflowDocument: WorkflowDocument): Promise<CleanWorkflowDocument> {
    const contents = workflowDocument.textDocument.getText().replace("position", "");
    const result: CleanWorkflowDocument = {
      contents: contents,
    };
    return result;
  }
}
