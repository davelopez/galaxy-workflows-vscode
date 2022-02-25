import { EventEmitter, ExtensionContext, TextDocumentContentProvider, Uri, workspace } from "vscode";
import { CommonLanguageClient, RequestType } from "vscode-languageclient";
import { Constants, LSRequestIdentifiers } from "../constants";
import { getWorkspaceScheme, replaceUriScheme } from "../utils";

interface CleanWorkflowDocumentParams {
  uri: string;
}

interface CleanWorkflowDocument {
  contents: string;
}

//TODO move this to a common lib
namespace CleanWorkflowDocumentRequest {
  export const type = new RequestType<CleanWorkflowDocumentParams, CleanWorkflowDocument, void>(
    LSRequestIdentifiers.CLEAN_WORKFLOW
  );
}

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

  async provideTextDocumentContent(uri: Uri): Promise<string> {
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
