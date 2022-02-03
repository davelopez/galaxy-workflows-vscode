import { EventEmitter, ExtensionContext, TextDocumentContentProvider, Uri, workspace } from "vscode";
import { LanguageClient, RequestType } from "vscode-languageclient/browser";
import { Constants } from "../constants";

interface CleanWorkflowDocumentParams {
  uri: string;
}

interface CleanWorkflowDocument {
  contents: string;
}

namespace CleanWorkflowDocumentRequest {
  export const type = new RequestType<CleanWorkflowDocumentParams, CleanWorkflowDocument, void>(
    "galaxy-workflows-ls.cleanWorkflow"
  );
}

export class CleanWorkflowDocumentProvider implements TextDocumentContentProvider {
  public static register(context: ExtensionContext, client: LanguageClient) {
    const provider = new CleanWorkflowDocumentProvider(client);
    context.subscriptions.push(
      workspace.registerTextDocumentContentProvider(Constants.CLEAN_WORKFLOW_DOCUMENT_SCHEME, provider)
    );
  }

  constructor(private readonly languageClient: LanguageClient) {}

  onDidChangeEmitter = new EventEmitter<Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  async provideTextDocumentContent(uri: Uri): Promise<string> {
    const originalUri = Uri.parse(uri.toString().replace(Constants.CLEAN_WORKFLOW_DOCUMENT_SCHEME, "file"));
    let params: CleanWorkflowDocumentParams = { uri: this.languageClient.code2ProtocolConverter.asUri(originalUri) };
    const result = await this.languageClient.sendRequest(CleanWorkflowDocumentRequest.type, params);
    if (!result) {
      return "Can not clean the requested document.";
    }
    return result.contents;
  }
}
