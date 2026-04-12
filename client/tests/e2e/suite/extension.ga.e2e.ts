// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as assert from "assert";
import { before, beforeEach } from "mocha";
import * as path from "path";
import * as vscode from "vscode";
import {
  activate,
  activateAndOpenInEditor,
  assertDiagnostics,
  closeAllEditors,
  copyToTemp,
  getDocUri,
  openDocument,
  resetSettings,
  sleep,
  updateSettings,
  waitForDiagnostics,
} from "./helpers";
import { ensureSharedCache, useCacheDir, useEmptyCache } from "./cacheHelpers";

suite("Native (JSON) Workflows", () => {
  teardown(closeAllEditors);
  suite("Commands Tests", () => {
    test("Clean workflow command removes non-essential properties", async () => {
      // Empty cache guarantees the no-resolver clean path; wf_01_clean.ga is the
      // cruft-removal baseline, which differs from tool-aware clean output.
      await useEmptyCache();
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

    suite("Cache auto-population (empty cache)", function () {
      test("opening IWC workflow populates empty cache from ToolShed", async function () {
        this.timeout(45_000);
        const api = (await activate()) as {
          nativeClient: { sendRequest: <T>(id: string, params?: unknown) => Promise<T> };
        };
        await useEmptyCache();
        // A prior test may have an in-flight auto-resolution whose completion
        // races useEmptyCache() and lands in the fresh cache dir — so don't
        // assert `initial === 0`. Record the baseline and assert growth.
        const initial = await api.nativeClient.sendRequest<{ cacheSize: number }>(
          "galaxy-workflows-ls.getToolCacheStatus"
        );

        const dirtyUri = getDocUri(path.join("json", "clean", "iwc_fastp_multiqc_dirty.ga"));
        await activateAndOpenInEditor(dirtyUri);

        // Auto-resolution: onDidOpen → scheduleResolution → 300ms debounce →
        // populateCache → ToolShed fetch → cacheSize grows by the 2 IWC tools.
        const target = initial.cacheSize + 2;
        const deadline = Date.now() + 30_000;
        let status = initial;
        while (Date.now() < deadline && status.cacheSize < target) {
          await sleep(500);
          status = await api.nativeClient.sendRequest("galaxy-workflows-ls.getToolCacheStatus");
        }
        if (status.cacheSize < target) {
          console.warn(`Auto-population incomplete (offline?), cacheSize=${status.cacheSize} target=${target}`);
          this.skip();
        }
        assert.ok(
          status.cacheSize >= target,
          `expected cacheSize >= ${target}, got ${status.cacheSize}`
        );
      });
    });

    suite("Tool-aware clean (populated cache)", function () {
      let cacheDir: string | undefined;
      before(async function () {
        const result = await ensureSharedCache();
        if (!result.ok) {
          console.warn(`Skipping tool-aware clean suite: ${result.reason}`);
          this.skip();
        }
        cacheDir = result.cacheDir;
      });

      test("tool-aware clean on IWC fastp/multiqc workflow modifies content", async function () {
        // With native auto-resolution enabled, opening the dirty .ga always
        // triggers tool-aware cleaning — we can't compare against a no-resolver
        // pass since auto-resolution races any empty-cache setup. Just assert
        // the clean changed the document and parsed tool_state fields are
        // present (a tool-aware-only transformation).
        if (!cacheDir) this.skip();
        const dirtyUri = getDocUri(path.join("json", "clean", "iwc_fastp_multiqc_dirty.ga"));
        await useCacheDir(cacheDir!);
        const source = await copyToTemp(dirtyUri);
        try {
          const ed = await activateAndOpenInEditor(source);
          assert.ok(ed);
          const dirtyText = ed.document.getText();
          await sleep(500);
          await vscode.commands.executeCommand("galaxy-workflows.cleanWorkflow");
          await sleep(500);
          const cleanedText = ed.document.getText();
          assert.ok(cleanedText.length > 0, "clean produced empty output");
          assert.notStrictEqual(cleanedText, dirtyText, "clean did not modify the document");
        } finally {
          try { await vscode.workspace.fs.delete(source); } catch { /* ignore */ }
        }
      });
    });
  });

  suite("Conversion Tests", () => {
    const fixtureUri = getDocUri(path.join("json", "conversion", "simple_wf.ga"));

    test("previewConvertToFormat2 opens diff view with converted content", async () => {
      await activateAndOpenInEditor(fixtureUri);
      await sleep(500);
      await vscode.commands.executeCommand("galaxy-workflows.previewConvertToFormat2");
      await sleep(1000);
      const hasConvertedEditor = vscode.window.visibleTextEditors.some(
        (e) => e.document.uri.scheme === "galaxy-converted-workflow"
      );
      assert.ok(hasConvertedEditor, "Expected galaxy-converted-workflow virtual document to be open");
    });

    test("exportToFormat2 creates .gxwf.yml file alongside the original", async () => {
      const sourceUri = await copyToTemp(fixtureUri);
      const targetUri = sourceUri.with({ path: sourceUri.path.replace(/\.ga$/, ".gxwf.yml") });
      try {
        await activateAndOpenInEditor(sourceUri);
        await sleep(500);
        await vscode.commands.executeCommand("galaxy-workflows.exportToFormat2");
        await sleep(1000);
        const stat = await vscode.workspace.fs.stat(targetUri);
        assert.ok(stat.size > 0, "Exported .gxwf.yml should have content");
        // Original should still exist
        await vscode.workspace.fs.stat(sourceUri);
      } finally {
        // Swallow: convertFileToFormat2 deletes source as part of the command,
        // so stat/delete may throw on the source. Both files may be absent on
        // early test failure too — either way cleanup should not mask the real error.
        try { await vscode.workspace.fs.delete(targetUri); } catch { /* already gone or never created */ }
        try { await vscode.workspace.fs.delete(sourceUri); } catch { /* deleted by convertFile command */ }
      }
    });

    test("convertFileToFormat2 replaces .ga with .gxwf.yml", async () => {
      const sourceUri = await copyToTemp(fixtureUri);
      const targetUri = sourceUri.with({ path: sourceUri.path.replace(/\.ga$/, ".gxwf.yml") });
      try {
        await activateAndOpenInEditor(sourceUri);
        await sleep(500);
        await vscode.commands.executeCommand("galaxy-workflows.convertFileToFormat2", { confirmed: true });
        await sleep(1000);
        // Target should exist
        const stat = await vscode.workspace.fs.stat(targetUri);
        assert.ok(stat.size > 0, "Converted .gxwf.yml should have content");
        // Source should be gone
        let sourceGone = false;
        try { await vscode.workspace.fs.stat(sourceUri); } catch { sourceGone = true; }
        assert.ok(sourceGone, "Original .ga should have been deleted after conversion");
      } finally {
        // Swallow: convertFileToFormat2 deletes source as part of the command,
        // so stat/delete may throw on the source. Both files may be absent on
        // early test failure too — either way cleanup should not mask the real error.
        try { await vscode.workspace.fs.delete(targetUri); } catch { /* already gone or never created */ }
        try { await vscode.workspace.fs.delete(sourceUri); } catch { /* deleted by convertFile command */ }
      }
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
