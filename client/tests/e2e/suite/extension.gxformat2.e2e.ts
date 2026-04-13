import * as assert from "assert";
import { beforeEach } from "mocha";
import * as path from "path";
import * as vscode from "vscode";
import {
  activateAndOpenInEditor,
  assertDiagnostics,
  closeAllEditors,
  getDocUri,
  isCacheMissDiagnostic,
  resetSettings,
  waitForDiagnostics,
  waitForDiagnosticMatching,
} from "./helpers";
import { useEmptyCache, usePopulatedCache } from "./cacheHelpers";
import { runConversionSuite } from "./conversionSuite";

suite("Format2 (YAML) Workflows", () => {
  teardown(closeAllEditors);
  runConversionSuite({
    label: "Conversion Tests",
    fixturePath: path.join("yaml", "conversion", "simple_wf.gxwf.yml"),
    previewCommand: "galaxy-workflows.previewConvertToNative",
    exportCommand: "galaxy-workflows.exportToNative",
    convertFileCommand: "galaxy-workflows.convertFileToNative",
    srcExtRegex: /\.gxwf\.(yml|yaml)$/,
    targetExt: ".ga",
    sourceLabel: ".gxwf.yml",
    targetLabel: ".ga",
  });

  suite("Tool State Validation Tests (empty cache)", () => {
    beforeEach(async () => {
      await useEmptyCache();
    });
    test("uncached tool emits info diagnostic", async () => {
      const docUri = getDocUri(path.join("yaml", "tool-state", "test_ts_smoke.gxwf.yml"));
      await activateAndOpenInEditor(docUri);
      const infoDiag = await waitForDiagnosticMatching(docUri, isCacheMissDiagnostic);
      assert.ok(
        infoDiag,
        `Expected info diagnostic for uncached tool, got: ${JSON.stringify(vscode.languages.getDiagnostics(docUri))}`
      );
    });
  });

  suite("Tool State Validation Tests (populated cache)", function () {
    usePopulatedCache();
    test("cached tool produces no cache-miss diagnostic", async () => {
      const docUri = getDocUri(path.join("yaml", "tool-state", "test_ts_smoke_cached.gxwf.yml"));
      await activateAndOpenInEditor(docUri);
      await waitForDiagnostics(docUri);
      const diags = vscode.languages.getDiagnostics(docUri);
      const cacheMiss = diags.find(isCacheMissDiagnostic);
      assert.ok(!cacheMiss, `Cached tool should not produce cache-miss diagnostic, got: ${JSON.stringify(diags)}`);
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
