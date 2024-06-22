// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as assert from "assert";
import { beforeEach } from "mocha";
import * as path from "path";
import * as vscode from "vscode";
import {
  activateAndOpenInEditor,
  assertDiagnostics,
  closeAllEditors,
  getDocUri,
  openDocument,
  resetSettings,
  sleep,
  updateSettings,
  waitForDiagnostics,
} from "./helpers";

suite("Native (JSON) Workflows", () => {
  teardown(closeAllEditors);
  suite("Commands Tests", () => {
    test("Clean workflow command removes non-essential properties", async () => {
      const dirtyDocUri = getDocUri(path.join("json", "clean", "wf_01_dirty.ga"));
      const cleanDocUri = getDocUri(path.join("json", "clean", "wf_01_clean.ga"));
      const editor = await activateAndOpenInEditor(dirtyDocUri);
      const document = editor?.document;
      assert.ok(document);
      await sleep(500); // Wait for extension to fully activate... yes Windows CI I'm looking at you...
      const dirtyDoc = document.getText();
      await vscode.commands.executeCommand("galaxy-workflows.cleanWorkflow");
      await sleep(500); // Wait for command to apply changes
      const actualCleanJson = document.getText();
      assert.notEqual(dirtyDoc, actualCleanJson);
      const expectedCleanDocument = await openDocument(cleanDocUri);
      assert.ok(expectedCleanDocument);
      const expectedCleanJson = expectedCleanDocument.getText();
      assert.strictEqual(actualCleanJson, expectedCleanJson);
    });
  });

  suite("Validation Tests", () => {
    beforeEach(async () => {
      await resetSettings();
    });
    test("Changing validation profile shows custom diagnostics", async () => {
      const docUri = getDocUri(path.join("json", "validation", "test_wf_03.ga"));
      await activateAndOpenInEditor(docUri);
      await assertDiagnostics(docUri, []); // Expect no issues

      // Change to stricter validation profile
      await updateSettings("validation.profile", "iwc");
      await waitForDiagnostics(docUri);
      await assertDiagnostics(docUri, [
        {
          message: "The workflow must have a release version.",
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)),
          severity: vscode.DiagnosticSeverity.Error,
        },
        {
          message: "The workflow does not specify a creator.",
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)),
          severity: vscode.DiagnosticSeverity.Warning,
        },
        {
          message: "The workflow does not specify a license.",
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)),
          severity: vscode.DiagnosticSeverity.Warning,
        },
        {
          message: "Missing label in workflow output.",
          range: new vscode.Range(new vscode.Position(16, 16), new vscode.Position(19, 17)),
          severity: vscode.DiagnosticSeverity.Error,
        },
        {
          message: "Missing label in workflow output.",
          range: new vscode.Range(new vscode.Position(20, 16), new vscode.Position(23, 17)),
          severity: vscode.DiagnosticSeverity.Error,
        },
      ]);

      await resetSettings();
      await waitForDiagnostics(docUri);
      await assertDiagnostics(docUri, []); // Expect no issues
    });
  });
});
