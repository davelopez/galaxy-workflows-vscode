import { EventEmitter, ExtensionContext, TextDocumentContentProvider, Uri, workspace } from "vscode";
import { Constants } from "../constants";
import { CleanWorkflowProvider } from "./cleanWorkflowProvider";

/**
 * Converts a regular document URI to a 'clean' workflow document URI.
 * @param uri The regular document URI.
 * @returns The URI with the scheme for clean workflows.
 */
export function toCleanWorkflowUri(uri: Uri): Uri {
  return Uri.parse(uri.toString().replace(uri.scheme, Constants.CLEAN_WORKFLOW_DOCUMENT_SCHEME));
}

/**
 * Implements the TextDocumentContentProvider for URIs with the `galaxy-clean-workflow`
 * scheme.
 * This will provide a document with the `clean contents` of the original workflow document.
 */
export class CleanWorkflowDocumentProvider implements TextDocumentContentProvider {
  public static register(context: ExtensionContext, cleanWorkflowProvider: CleanWorkflowProvider): void {
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
