import { workspace } from "vscode";
import { URI } from "vscode-uri";

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
export function replaceUriScheme(uri: URI, targetScheme: string): URI {
  return URI.parse(uri.toString().replace(uri.scheme, targetScheme));
}

/**
 * Adds a `ref` value to the URI query.
 * @param uri The URI to be modified
 * @param ref The git ref to add to the URI query
 * @returns The URI with a ref query value set
 */
export function addRefToUri(uri: URI, ref: string): URI {
  return URI.parse(uri.toString() + `?ref=${ref}`);
}

// Workflow tests document can end with -test.yml, -tests.yml, -test.yaml, -tests.yaml
const workflowTestsDocumentPattern = /(.*)-(test|tests)\.(yml|yaml)$/;

// Workflow format1 documents can end with .ga
// Workflow format2 documents can end with .gxwf.yml or .gxwf.yaml
const format1WorkflowDocumentPattern = /\.ga$/;
const format2WorkflowDocumentPattern = /\.gxwf\.(yml|yaml)$/;

export function isWorkflowTestsDocument(uri: URI): boolean {
  return workflowTestsDocumentPattern.test(uri.path);
}

export function isNativeWorkflowDocument(uri: URI): boolean {
  return format1WorkflowDocumentPattern.test(uri.path);
}

export function isFormat2WorkflowDocument(uri: URI): boolean {
  return format2WorkflowDocumentPattern.test(uri.path);
}

export async function getAssociatedWorkflowUriFromTestsUri(workflowTestsDocumentUri: URI): Promise<URI | undefined> {
  if (!isWorkflowTestsDocument(workflowTestsDocumentUri)) {
    return undefined;
  }

  //Try to find a format1 workflow document first
  let workflowDocumentUri = replaceUriPattern(workflowTestsDocumentUri, workflowTestsDocumentPattern, ".ga");
  if (await fileUriExistsInWorkspace(workflowDocumentUri)) {
    return workflowDocumentUri;
  }
  //Try to find a format2 workflow document
  workflowDocumentUri = replaceUriPattern(workflowTestsDocumentUri, workflowTestsDocumentPattern, ".gxwf.yaml");
  if (await fileUriExistsInWorkspace(workflowDocumentUri)) {
    return workflowDocumentUri;
  }

  workflowDocumentUri = replaceUriPattern(workflowTestsDocumentUri, workflowTestsDocumentPattern, ".gxwf.yml");
  if (await fileUriExistsInWorkspace(workflowDocumentUri)) {
    return workflowDocumentUri;
  }
  return undefined;
}

/**
 * Replaces the matched pattern in the URI path with the replacement.
 * @param uri The URI to be modified.
 * @param pattern The pattern to match in the URI path.
 * @param replacement The replacement string.
 * @returns A new copy of the URI with the pattern replaced.
 */
export function replaceUriPattern(uri: URI, pattern: RegExp, replacement: string): URI {
  const uriString = uri.toString();
  const newUriString = uriString.replace(pattern, `$1${replacement}`);
  const result = URI.parse(newUriString);
  return result;
}

/**
 * Determines if a file exists at the given URI in the workspace.
 * @param uri The URI to check for existence.
 * @returns true if the (virtual) file exists, false otherwise.
 */
export async function fileUriExistsInWorkspace(uri: URI): Promise<boolean> {
  try {
    await workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
