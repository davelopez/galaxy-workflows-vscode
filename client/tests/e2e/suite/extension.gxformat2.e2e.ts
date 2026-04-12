import * as assert from "assert";
import { beforeEach } from "mocha";
import * as path from "path";
import * as vscode from "vscode";
import {
  activateAndOpenInEditor,
  assertDiagnostics,
  closeAllEditors,
  copyToTemp,
  getDocUri,
  resetSettings,
  sleep,
  waitForDiagnostics,
} from "./helpers";

suite("Format2 (YAML) Workflows", () => {
  teardown(closeAllEditors);
  suite("Conversion Tests", () => {
    const fixtureUri = getDocUri(path.join("yaml", "conversion", "simple_wf.gxwf.yml"));

    test("previewConvertToNative opens diff view with converted content", async () => {
      await activateAndOpenInEditor(fixtureUri);
      await sleep(500);
      await vscode.commands.executeCommand("galaxy-workflows.previewConvertToNative");
      await sleep(1000);
      const hasConvertedEditor = vscode.window.visibleTextEditors.some(
        (e) => e.document.uri.scheme === "galaxy-converted-workflow"
      );
      assert.ok(hasConvertedEditor, "Expected galaxy-converted-workflow virtual document to be open");
    });

    test("exportToNative creates .ga file alongside the original", async () => {
      const sourceUri = await copyToTemp(fixtureUri);
      const targetUri = sourceUri.with({ path: sourceUri.path.replace(/\.gxwf\.(yml|yaml)$/, ".ga") });
      try {
        await activateAndOpenInEditor(sourceUri);
        await sleep(500);
        await vscode.commands.executeCommand("galaxy-workflows.exportToNative");
        await sleep(1000);
        const stat = await vscode.workspace.fs.stat(targetUri);
        assert.ok(stat.size > 0, "Exported .ga should have content");
        // Original should still exist
        await vscode.workspace.fs.stat(sourceUri);
      } finally {
        // Swallow: convertFileToNative deletes source as part of the command,
        // so stat/delete may throw on the source. Both files may be absent on
        // early test failure too — either way cleanup should not mask the real error.
        try { await vscode.workspace.fs.delete(targetUri); } catch { /* already gone or never created */ }
        try { await vscode.workspace.fs.delete(sourceUri); } catch { /* deleted by convertFile command */ }
      }
    });

    test("convertFileToNative replaces .gxwf.yml with .ga", async () => {
      const sourceUri = await copyToTemp(fixtureUri);
      const targetUri = sourceUri.with({ path: sourceUri.path.replace(/\.gxwf\.(yml|yaml)$/, ".ga") });
      try {
        await activateAndOpenInEditor(sourceUri);
        await sleep(500);
        await vscode.commands.executeCommand("galaxy-workflows.convertFileToNative", { confirmed: true });
        await sleep(1000);
        const stat = await vscode.workspace.fs.stat(targetUri);
        assert.ok(stat.size > 0, "Converted .ga should have content");
        let sourceGone = false;
        try { await vscode.workspace.fs.stat(sourceUri); } catch { sourceGone = true; }
        assert.ok(sourceGone, "Original .gxwf.yml should have been deleted after conversion");
      } finally {
        // Swallow: convertFileToNative deletes source as part of the command,
        // so stat/delete may throw on the source. Both files may be absent on
        // early test failure too — either way cleanup should not mask the real error.
        try { await vscode.workspace.fs.delete(targetUri); } catch { /* already gone or never created */ }
        try { await vscode.workspace.fs.delete(sourceUri); } catch { /* deleted by convertFile command */ }
      }
    });
  });

  suite("Tool State Validation Tests", () => {
    test("uncached tool emits info diagnostic", async () => {
      const docUri = getDocUri(path.join("yaml", "tool-state", "test_ts_smoke.gxwf.yml"));
      await activateAndOpenInEditor(docUri);
      await waitForDiagnostics(docUri);
      const diags = vscode.languages.getDiagnostics(docUri);
      const infoDiag = diags.find(
        (d) =>
          d.severity === vscode.DiagnosticSeverity.Information &&
          d.message.includes("not in the local cache")
      );
      assert.ok(infoDiag, `Expected info diagnostic for uncached tool, got: ${JSON.stringify(diags)}`);
    });
  });
  suite("Validation Tests", () => {
    beforeEach(async () => {
      await resetSettings();
    });
    test("Missing required fields return diagnostics", async () => {
      const docUri = getDocUri(path.join("yaml", "validation", "test_wf_00.gxwf.yml"));
      await activateAndOpenInEditor(docUri);
      await waitForDiagnostics(docUri);
      await assertDiagnostics(docUri, [
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
        {
          message: "The 'steps' field is required.",
          range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 21)),
          severity: vscode.DiagnosticSeverity.Error,
        },
      ]);
    });
  });
});
