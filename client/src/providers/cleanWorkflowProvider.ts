import { Uri, window } from "vscode";
import { CommonLanguageClient } from "vscode-languageclient";
import {
  CleanWorkflowContentsParams,
  CleanWorkflowContentsRequest,
  CleanWorkflowDocumentParams,
  CleanWorkflowDocumentRequest,
} from "../requestsDefinitions";
import { getWorkspaceScheme, replaceUriScheme } from "../utils";
import { GitProvider } from "./git/common";

export class CleanWorkflowProvider {
  constructor(private readonly languageClient: CommonLanguageClient, private readonly gitProvider: GitProvider) {}

  public async cleanFromDocumentUri(uri: Uri): Promise<string> {
    const realDocumentUri = this.convertToWorkspaceUri(uri);
    if (this.uriHasGitRef(realDocumentUri)) {
      return this.getCleanWorkflowFromGitRef(realDocumentUri);
    }
    return await this.requestCleanDocumentFromUri(realDocumentUri);
  }

  private async getCleanWorkflowFromGitRef(uri: Uri): Promise<string> {
    if (this.gitProvider.isInitialized) {
      const ref = this.getRefFromUri(uri);
      const contents = await this.gitProvider.getContents(uri, ref);
      return this.requestCleanContents(contents);
    } else {
      window.showErrorMessage("This operation requires GIT to be active.");
    }
  }

  private async requestCleanContents(contents: string): Promise<string> {
    let params: CleanWorkflowContentsParams = {
      contents: contents,
    };
    const result = await this.languageClient.sendRequest(CleanWorkflowContentsRequest.type, params);
    if (!result) {
      throw new Error("Cannot clean the requested document contents. The server returned no content");
    }
    return result.contents;
  }

  private async requestCleanDocumentFromUri(realDocumentUri: Uri) {
    let params: CleanWorkflowDocumentParams = {
      uri: this.languageClient.code2ProtocolConverter.asUri(realDocumentUri),
    };
    const result = await this.languageClient.sendRequest(CleanWorkflowDocumentRequest.type, params);
    if (!result) {
      throw new Error("Cannot clean the requested document. The server returned no content");
    }
    return result.contents;
  }

  private convertToWorkspaceUri(uri: Uri) {
    const targetScheme = getWorkspaceScheme();
    return replaceUriScheme(uri, targetScheme);
  }

  private uriHasGitRef(uri: Uri) {
    return uri.query && uri.query.startsWith("ref=");
  }

  private getRefFromUri(uri: Uri): string {
    return uri.query.replace("ref=", "");
  }
}
