import { EventEmitter, ExtensionContext, TextDocumentContentProvider, Uri, workspace } from "vscode";
import { Constants } from "../common/constants";

/**
 * Converts a regular workflow document URI to a converted-workflow virtual URI.
 */
export function toConvertedWorkflowUri(uri: Uri): Uri {
  return Uri.parse(uri.toString().replace(uri.scheme, Constants.CONVERTED_WORKFLOW_DOCUMENT_SCHEME));
}

/**
 * TextDocumentContentProvider for URIs with the `galaxy-converted-workflow` scheme.
 * Stores converted workflow text keyed by URI so the diff editor can read it.
 */
export class ConvertedWorkflowDocumentProvider implements TextDocumentContentProvider {
  private _contents = new Map<string, string>();

  readonly onDidChangeEmitter = new EventEmitter<Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  public static register(context: ExtensionContext): ConvertedWorkflowDocumentProvider {
    const provider = new ConvertedWorkflowDocumentProvider();
    context.subscriptions.push(
      workspace.registerTextDocumentContentProvider(Constants.CONVERTED_WORKFLOW_DOCUMENT_SCHEME, provider)
    );
    return provider;
  }

  public setContents(uri: Uri, contents: string): void {
    this._contents.set(uri.toString(), contents);
    this.onDidChangeEmitter.fire(uri);
  }

  public provideTextDocumentContent(uri: Uri): string {
    return this._contents.get(uri.toString()) ?? "";
  }
}
