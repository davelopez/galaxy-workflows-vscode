import { EventEmitter, ExtensionContext, TextDocumentContentProvider, Uri, workspace } from "vscode";
import { Constants } from "../constants";
import { CleanWorkflowProvider } from "./cleanWorkflowProvider";

export function toCleanWorkflowUri(uri: Uri): Uri {
  return Uri.parse(uri.toString().replace(uri.scheme, Constants.CLEAN_WORKFLOW_DOCUMENT_SCHEME));
}
export class CleanWorkflowDocumentProvider implements TextDocumentContentProvider {
  public static register(context: ExtensionContext, cleanWorkflowProvider: CleanWorkflowProvider) {
    const provider = new CleanWorkflowDocumentProvider(cleanWorkflowProvider);
    context.subscriptions.push(
      workspace.registerTextDocumentContentProvider(Constants.CLEAN_WORKFLOW_DOCUMENT_SCHEME, provider)
    );
  }

  constructor(private readonly cleanWorkflowProvider: CleanWorkflowProvider) {}

  onDidChangeEmitter = new EventEmitter<Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  public async provideTextDocumentContent(uri: Uri): Promise<string> {
    return this.cleanWorkflowProvider.cleanFromDocumentUri(uri);
  }
}
