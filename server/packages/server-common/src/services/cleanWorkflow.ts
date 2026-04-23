import { ApplyWorkspaceEditParams, Range, TextDocumentEdit, TextEdit } from "vscode-languageserver";
import { ServiceBase } from ".";

import {
  CleanWorkflowContentsParams,
  CleanWorkflowContentsResult,
  CleanWorkflowDocumentParams,
  CleanWorkflowDocumentResult,
  GalaxyWorkflowLanguageServer,
  LSRequestIdentifiers,
} from "../languageTypes";

/**
 * Service for handling workflow `cleaning` requests.
 * Delegates to each language service's cleanWorkflowText() which in turn
 * delegates to cleanWorkflow() from @galaxy-tool-util/schema.
 */
export class CleanWorkflowService extends ServiceBase {
  public static register(server: GalaxyWorkflowLanguageServer): CleanWorkflowService {
    return new CleanWorkflowService(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
  }

  protected listenToRequests(): void {
    this.server.connection.onRequest(
      LSRequestIdentifiers.CLEAN_WORKFLOW_CONTENTS,
      (params: CleanWorkflowContentsParams) => this.onCleanWorkflowContentsRequest(params)
    );
    this.server.connection.onRequest(
      LSRequestIdentifiers.CLEAN_WORKFLOW_DOCUMENT,
      (params: CleanWorkflowDocumentParams) => this.onCleanWorkflowDocumentRequest(params)
    );
  }

  private async onCleanWorkflowContentsRequest(
    params: CleanWorkflowContentsParams
  ): Promise<CleanWorkflowContentsResult | undefined> {
    const languageId = this.detectLanguageId(params.contents);
    const languageService = this.server.getLanguageServiceById(languageId);
    const contents = await languageService.cleanWorkflowText(params.contents);
    return { contents };
  }

  private async onCleanWorkflowDocumentRequest(
    params: CleanWorkflowDocumentParams
  ): Promise<CleanWorkflowDocumentResult> {
    try {
      const workflowDocument = this.server.documentsCache.get(params.uri);
      if (workflowDocument) {
        const document = workflowDocument.textDocument;
        const text = document.getText();
        const languageService = this.server.getLanguageServiceById(document.languageId);
        const cleanedText = await languageService.cleanWorkflowText(text);
        const fullRange = Range.create(document.positionAt(0), document.positionAt(text.length));
        const editParams: ApplyWorkspaceEditParams = {
          label: "Clean workflow",
          edit: {
            documentChanges: [
              TextDocumentEdit.create({ uri: params.uri, version: null }, [TextEdit.replace(fullRange, cleanedText)]),
            ],
          },
        };
        this.server.connection.workspace.applyEdit(editParams);
      }
      return { error: "" };
    } catch (error) {
      return { error: String(error) };
    }
  }
}
