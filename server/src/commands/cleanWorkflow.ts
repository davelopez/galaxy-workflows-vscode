import { RequestType, URI } from "vscode-languageserver";
import { WorkflowDocument } from "../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../server";
import { CustomCommand } from "./common";

export interface CleanWorkflowDocumentParams {
  uri: URI;
}

export interface CleanWorkflowDocument {
  contents: string;
}

export namespace CleanWorkflowDocumentRequest {
  export const type = new RequestType<CleanWorkflowDocumentParams, CleanWorkflowDocument, void>(
    "galaxy-workflows-ls.cleanWorkflow"
  );
}

export class CleanWorkflowCommand extends CustomCommand {
  public static register(server: GalaxyWorkflowLanguageServer): CleanWorkflowCommand {
    return new CleanWorkflowCommand(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);

    this.connection.onRequest(CleanWorkflowDocumentRequest.type, async (params) => {
      this.connection.console.log(`ON REQUEST CleanWorkflowDocumentRequest params: ${params.uri}`);
      const workflowDocument = this.workflowDocuments.get(params.uri);
      if (!workflowDocument) {
        this.connection.console.log(`WORKFLOW ${params.uri} NOT FOUND`);
        return undefined;
      }
      this.connection.console.log(`WORKFLOW: ${workflowDocument.documentUri}`);
      return await this.cleanWorkflow(workflowDocument);
    });
  }

  private async cleanWorkflow(workflowDocument: WorkflowDocument): Promise<CleanWorkflowDocument> {
    const result: CleanWorkflowDocument = {
      contents: workflowDocument.textDocument.getText().replace("position", ""),
    };
    return result;
  }
}
