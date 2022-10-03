// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as path from "path";
import * as assert from "assert";
import { beforeEach } from "mocha";
import {
  activateAndOpenInEditor,
  getDocUri,
  closeAllEditors,
  assertDiagnostics,
  resetSettings,
  waitForDiagnostics,
} from "./helpers";

suite("Format2 (YAML) Workflows", () => {
  teardown(closeAllEditors);
  suite("Validation Tests", () => {
    beforeEach(async () => {
      await resetSettings();
    });
    test("Missing required fields return diagnostics", async () => {
      const docUri = getDocUri(path.join("yaml", "validation", "test_wf_00.gxwf.yml"));
      await activateAndOpenInEditor(docUri);
      await waitForDiagnostics();
      await assertDiagnostics(docUri, [
        {
          message: "The 'steps' field is required.",
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 21)),
          severity: vscode.DiagnosticSeverity.Error,
        },
        {
          message: "The 'inputs' field is required.",
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 21)),
          severity: vscode.DiagnosticSeverity.Error,
        },
        {
          message: "The 'outputs' field is required.",
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 21)),
          severity: vscode.DiagnosticSeverity.Error,
        },
      ]);
    });
  });
});
