import * as assert from "assert";
import * as crypto from "crypto";
import * as os from "os";
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

export async function waitForDiagnosticMatching(
  docUri: vscode.Uri,
  predicate: (d: vscode.Diagnostic) => boolean,
  timeoutInMilliseconds = 3000
): Promise<vscode.Diagnostic | undefined> {
  const waitMilliseconds = 100;
  let waitTimeout = timeoutInMilliseconds;
  while (waitTimeout > 0) {
    const match = vscode.languages.getDiagnostics(docUri).find(predicate);
    if (match) return match;
    await sleep(waitMilliseconds);
    waitTimeout -= waitMilliseconds;
  }
  return undefined;
}

export async function waitForDiagnosticGone(
  docUri: vscode.Uri,
  predicate: (d: vscode.Diagnostic) => boolean,
  timeoutInMilliseconds = 2000
): Promise<boolean> {
  const waitMilliseconds = 100;
  let waitTimeout = timeoutInMilliseconds;
  while (waitTimeout > 0) {
    const match = vscode.languages.getDiagnostics(docUri).some(predicate);
    if (!match) return true;
    await sleep(waitMilliseconds);
    waitTimeout -= waitMilliseconds;
  }
  return !vscode.languages.getDiagnostics(docUri).some(predicate);
}

export function isCacheMissDiagnostic(d: vscode.Diagnostic): boolean {
  return d.severity === vscode.DiagnosticSeverity.Information && d.message.includes("not in the local cache");
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

/**
 * Copies a test fixture to a unique temp file, preserving the full filename
 * (including compound extensions like .gxwf.yml). Returns the temp URI.
 * Caller is responsible for deleting the temp file after use.
 */
export async function copyToTemp(sourceUri: vscode.Uri): Promise<vscode.Uri> {
  const content = await vscode.workspace.fs.readFile(sourceUri);
  const fileName = path.basename(sourceUri.path);
  const tempName = `${crypto.randomBytes(4).toString("hex")}_${fileName}`;
  const tempPath = path.join(os.tmpdir(), tempName);
  const tempUri = vscode.Uri.file(tempPath);
  await vscode.workspace.fs.writeFile(tempUri, content);
  return tempUri;
}

async function safeDelete(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.delete(uri);
  } catch {
    /* already gone, or command deleted it (e.g. convertFile) */
  }
}

/**
 * Copies a fixture to a temp file, runs the callback with the temp URI, and
 * always cleans up the temp file plus any extra URIs (e.g. a converted target
 * with a different extension). Handles the case where a command (like
 * convertFileToNative) deletes the source itself.
 */
export async function withTempFixture<T>(
  sourceUri: vscode.Uri,
  fn: (tempUri: vscode.Uri) => Promise<T>,
  extras: (tempUri: vscode.Uri) => vscode.Uri[] = () => []
): Promise<T> {
  const tempUri = await copyToTemp(sourceUri);
  try {
    return await fn(tempUri);
  } finally {
    for (const extra of extras(tempUri)) await safeDelete(extra);
    await safeDelete(tempUri);
  }
}

export async function resetSettings(): Promise<void> {
  const configuration = vscode.workspace.getConfiguration("galaxyWorkflows");
  await configuration.update("validation.profile", undefined, true);
  await configuration.update("toolCache.directory", undefined, true);
  return sleep(500); // Wait for settings to be applied
}
