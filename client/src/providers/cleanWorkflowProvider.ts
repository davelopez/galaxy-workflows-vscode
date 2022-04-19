import { Uri, window, workspace } from "vscode";
import { CommonLanguageClient } from "vscode-languageclient";
import { CleanWorkflowContentsParams, CleanWorkflowContentsRequest } from "../requestsDefinitions";
import { getWorkspaceScheme, replaceUriScheme } from "../utils";
import { GitProvider } from "./git/common";

/**
 * Provides utilities to clean (remove non-workflow logic related parts)
 * workflow documents.
 */
export class CleanWorkflowProvider {
  constructor(private readonly languageClient: CommonLanguageClient, private readonly gitProvider: GitProvider) {}

  /**
   * Retrieves the clean contents of a given workflow document.
   * If the URI contains a git `ref` in the query part it will
   * retrieve the contents of that particular revision of the workflow document.
   * @param uri The workflow document URI
   * @returns The clean contents of the workflow document
   */
  public async cleanFromDocumentUri(uri: Uri): Promise<string> {
    const realDocumentUri = this.convertToWorkspaceUri(uri);
    if (this.uriHasGitRef(realDocumentUri)) {
      return this.getCleanWorkflowFromGitRef(realDocumentUri);
    }
    return await this.requestCleanDocumentFromUri(realDocumentUri);
  }

  /**
   * Requests clean workflow contents from a particular git revision
   * of the workflow document.
   * @param uri The workflow URI with it's git ref
   * @returns The clean contents of the given workflow revision
   */
  private async getCleanWorkflowFromGitRef(uri: Uri): Promise<string> {
    if (this.gitProvider.isInitialized) {
      const ref = this.getRefFromUri(uri);
      const contents = await this.gitProvider.getContents(uri, ref);
      return this.requestCleanContents(contents);
    } else {
      window.showErrorMessage("This operation requires GIT to be active.");
    }
  }

  /**
   * Request the language server to provide a clean version of the given
   * workflow contents.
   * @param contents The 'dirty' contents of the workflow document.
   * @returns The 'clean' contents of the workflow document.
   */
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

  /**
   * Requests the language server to provide a clean version of the
   * workflow document.
   * @param uri The 'dirty' workflow document URI.
   * @returns The 'clean' contents of the given workflow document.
   */
  private async requestCleanDocumentFromUri(uri: Uri) {
    // Opening the document will fire the onDidOpen and onDidChangeContent events
    const workflowDocument = await workspace.openTextDocument(uri);
    const contents = workflowDocument.getText();
    // After this point we no longer need the document but there is no programmatically way of closing it.
    // The Editor takes care of the document lifecycle so, at some point, it will
    // automatically close the document and then fire the OnDidClose event
    return this.requestCleanContents(contents);
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
