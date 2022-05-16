import * as vscode from "vscode";
import * as path from "path";
import * as assert from "assert";

/**
 * Contains the document and its corresponding editor
 */
export interface DocumentEditor {
  editor: vscode.TextEditor;
  document: vscode.TextDocument;
}

export async function activate(): Promise<unknown> {
  const ext = vscode.extensions.getExtension("davelopez.galaxy-workflows");
  const api = ext.isActive ? ext.exports : await ext.activate();
  return api;
}

export async function openDocumentInEditor(docUri: vscode.Uri): Promise<DocumentEditor> {
  try {
    const document = await vscode.workspace.openTextDocument(docUri);
    const editor = await vscode.window.showTextDocument(document);
    return {
      editor,
      document,
    };
  } catch (e) {
    console.error(e);
  }
}

export async function openDocument(docUri: vscode.Uri): Promise<vscode.TextDocument> {
  try {
    const document = await vscode.workspace.openTextDocument(docUri);
    return document;
  } catch (e) {
    console.error(e);
  }
}

export async function activateAndOpenInEditor(docUri: vscode.Uri): Promise<DocumentEditor> {
  await activate();
  const documentEditor = await openDocumentInEditor(docUri);
  await sleep(2000); // Wait for server activation
  return documentEditor;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const getDocPath = (filePath: string): string => {
  return path.resolve(__dirname, path.join("..", "..", "..", "..", "test-data", filePath));
};

export const getDocUri = (filePath: string): vscode.Uri => {
  return vscode.Uri.file(getDocPath(filePath));
};

export async function assertDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]): Promise<void> {
  const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

  assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

  expectedDiagnostics.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = actualDiagnostics[i];
    assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
    assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
    assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
  });
}

/**
 * Asserts that the given workflow document has no diagnostics i.e. is valid.
 * @param docUri Workflow document URI
 */
export async function assertValid(docUri: vscode.Uri): Promise<void> {
  const actualDiagnostics = vscode.languages.getDiagnostics(docUri);
  assert.equal(actualDiagnostics.length, 0);
}

export function closeAllEditors(): Thenable<unknown> {
  return vscode.commands.executeCommand("workbench.action.closeAllEditors");
}
