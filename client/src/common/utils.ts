import { OutputChannel, Uri, workspace } from "vscode";

/**
 * Determines if the current workspace contains
 * @returns true if the workspace is not mounted on a regular filesystem.
 */
export function isVirtualWorkspace(): boolean {
  return (workspace.workspaceFolders ?? []).every((f) => f.uri.scheme !== "file");
}

/**
 * Determines the correct document URI scheme depending on the current type of workspace.
 * @returns Current workspace scheme
 */
export function getWorkspaceScheme(): "file" | "vscode-vfs" {
  return isVirtualWorkspace() ? "vscode-vfs" : "file";
}

/**
 * Returns a copy of the URI with the new URI scheme instead of the original.
 * @param uri The URI to be modified.
 * @param targetScheme The new scheme.
 * @returns A new copy of the URI with the new scheme.
 */
export function replaceUriScheme(uri: Uri, targetScheme: string): Uri {
  return Uri.parse(uri.toString().replace(uri.scheme, targetScheme));
}

/**
 * Adds a `ref` value to the URI query.
 * @param uri The URI to be modified
 * @param ref The git ref to add to the URI query
 * @returns The URI with a ref query value set
 */
export function addRefToUri(uri: Uri, ref: string): Uri {
  return Uri.parse(uri.toString() + `?ref=${ref}`);
}

/** Just for debugging */
export function debugPrintCommandArgs(command: string, args: unknown[], outputChannel: OutputChannel): void {
  outputChannel.appendLine(`Command ${command} args:`);
  for (let index = 0; index < args.length; index++) {
    const element = args[index];
    outputChannel.appendLine(` [${index}] ${JSON.stringify(element)}`);
  }
  outputChannel.appendLine(`---\n`);
}

export function isWorkflowTestsDocument(uri: Uri): boolean {
  return uri.path.endsWith("-test.yml");
}

export function isNativeWorkflowDocument(uri: Uri): boolean {
  return uri.path.endsWith(".ga");
}

export async function getAssociatedWorkflowUriFromTestsUri(workflowTestsDocumentUri: Uri): Promise<Uri | undefined> {
  const format2WorkflowUri = Uri.parse(workflowTestsDocumentUri.toString().replace("-test.yml", ".yml"));
  try {
    await workspace.fs.stat(format2WorkflowUri);
    return format2WorkflowUri;
  } catch {
    const nativeWorkflowUri = Uri.parse(workflowTestsDocumentUri.toString().replace("-test.yml", ".ga"));
    try {
      await workspace.fs.stat(nativeWorkflowUri);
      return nativeWorkflowUri;
    } catch {
      return undefined;
    }
  }
}
