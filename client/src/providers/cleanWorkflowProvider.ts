import { Uri } from "vscode";
import { CommonLanguageClient } from "vscode-languageclient";
import {
  CleanWorkflowContentsParams,
  CleanWorkflowContentsRequest,
  CleanWorkflowDocumentParams,
  CleanWorkflowDocumentRequest,
} from "../requestsDefinitions";
import { getWorkspaceScheme, replaceUriScheme } from "../utils";

export class CleanWorkflowProvider {
  constructor(private readonly languageClient: CommonLanguageClient) {}

  public async cleanFromDocumentUri(uri: Uri): Promise<string> {
    const realDocumentUri = this.convertToWorkspaceUri(uri);
    let params: CleanWorkflowDocumentParams = {
      uri: this.languageClient.code2ProtocolConverter.asUri(realDocumentUri),
    };
    const result = await this.languageClient.sendRequest(CleanWorkflowDocumentRequest.type, params);
    if (!result) {
      throw new Error("Cannot clean the requested document. The server returned no content");
    }
    return result.contents;
  }

  public async cleanFromContents(contents: string): Promise<string> {
    let params: CleanWorkflowContentsParams = {
      contents: contents,
    };
    const result = await this.languageClient.sendRequest(CleanWorkflowContentsRequest.type, params);
    if (!result) {
      throw new Error("Cannot clean the requested document contents. The server returned no content");
    }
    return result.contents;
  }

  private convertToWorkspaceUri(uri: Uri) {
    const targetScheme = getWorkspaceScheme();
    return replaceUriScheme(uri, targetScheme);
  }
}
