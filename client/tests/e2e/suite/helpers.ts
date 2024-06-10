import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";

/**
 * Contains the document and its corresponding editor
 */
export interface DocumentEditor {
  editor: vscode.TextEditor;
  document: vscode.TextDocument;
}

export async function activate(): Promise<unknown> {
  const ext = vscode.extensions.getExtension("davelopez.galaxy-workflows");
  const api = ext?.isActive ? ext.exports : await ext?.activate();
  return api;
}

export async function openDocumentInEditor(docUri: vscode.Uri): Promise<DocumentEditor | undefined> {
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

export async function openDocument(docUri: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  try {
    const document = await vscode.workspace.openTextDocument(docUri);
    return document;
  } catch (e) {
    console.error(e);
  }

  return undefined;
}

export async function activateAndOpenInEditor(docUri: vscode.Uri): Promise<DocumentEditor | undefined> {
  await activate();
  const documentEditor = await openDocumentInEditor(docUri);
  return documentEditor;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForDiagnostics(docUri: vscode.Uri, timeoutInMilliseconds = 2000): Promise<void> {
  const waitMilliseconds = 100;
  let waitTimeout = timeoutInMilliseconds;
  let diagnostics = vscode.languages.getDiagnostics(docUri);
  while (waitTimeout > 0 && !diagnostics.length) {
    await sleep(waitMilliseconds);
    waitTimeout -= waitMilliseconds;
    diagnostics = vscode.languages.getDiagnostics(docUri);
  }
}

export const getDocPath = (filePath: string): string => {
  return path.resolve(__dirname, path.join("..", "..", "..", "..", "..", "test-data", filePath));
};

export const getDocUri = (filePath: string): vscode.Uri => {
  return vscode.Uri.file(getDocPath(filePath));
};

export async function assertDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]): Promise<void> {
  const actualDiagnostics = vscode.languages.getDiagnostics(docUri);
  // console.log("DEBUG DIAGNOSTICS", JSON.stringify(actualDiagnostics, undefined, 2));

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

export async function updateSettings(setting: string, value: unknown): Promise<void> {
  const configuration = vscode.workspace.getConfiguration("galaxyWorkflows", null);
  return configuration.update(setting, value, true);
}

export async function resetSettings(): Promise<void> {
  const configuration = vscode.workspace.getConfiguration("galaxyWorkflows");
  await configuration.update("cleaning.cleanableProperties", undefined, true);
  await configuration.update("validation.profile", undefined, true);
  return sleep(500); // Wait for settings to be applied
}
