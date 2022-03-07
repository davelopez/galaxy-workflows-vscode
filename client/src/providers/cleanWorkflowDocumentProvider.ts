import { EventEmitter, ExtensionContext, TextDocumentContentProvider, Uri, workspace } from "vscode";
import { CommonLanguageClient } from "vscode-languageclient";
import { Constants } from "../constants";
import {
  CleanWorkflowContentsParams,
  CleanWorkflowContentsRequest,
  CleanWorkflowDocumentParams,
  CleanWorkflowDocumentRequest,
} from "../requestsDefinitions";
import { getWorkspaceScheme, replaceUriScheme } from "../utils";

export class CleanWorkflowDocumentProvider implements TextDocumentContentProvider {
  public static register(context: ExtensionContext, client: CommonLanguageClient) {
    const provider = new CleanWorkflowDocumentProvider(client);
    context.subscriptions.push(
      workspace.registerTextDocumentContentProvider(Constants.CLEAN_WORKFLOW_DOCUMENT_SCHEME, provider)
    );
  }

  constructor(private readonly languageClient: CommonLanguageClient) {}

  onDidChangeEmitter = new EventEmitter<Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  public async provideTextDocumentContent(uri: Uri): Promise<string> {
    return this.cleanFromDocumentUri(uri);
  }

  private async cleanFromDocumentUri(uri: Uri): Promise<string> {
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

  private convertToWorkspaceUri(uri: Uri) {
    const targetScheme = getWorkspaceScheme();
    return replaceUriScheme(uri, targetScheme);
  }
}

export function toCleanWorkflowUri(uri: Uri): Uri {
  return Uri.parse(uri.toString().replace(uri.scheme, Constants.CLEAN_WORKFLOW_DOCUMENT_SCHEME));
}
