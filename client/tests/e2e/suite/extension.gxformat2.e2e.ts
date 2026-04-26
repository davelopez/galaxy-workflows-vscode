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
  sleep,
  updateSettings,
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

    test("empty state: block offers tool parameter completions", async () => {
      // Fixture has an empty `state:` for a cached fastp step. Trigger
      // completions inside the block; expect fastp parameter names. Exact
      // param set depends on fastp's xml — assert on a couple known-stable
      // top-level params.
      const docUri = getDocUri(path.join("yaml", "tool-state", "test_ts_completion.gxwf.yml"));
      const opened = await activateAndOpenInEditor(docUri);
      assert.ok(opened, "Failed to open fixture");
      const { editor, document: doc } = opened;
      // Append an indented blank line inside the state block at runtime so the
      // fixture stays format-stable (Prettier strips trailing whitespace).
      await editor.edit((eb) => eb.insert(doc.lineAt(doc.lineCount - 1).range.end, "\n      "));
      await sleep(500);
      const pos = new vscode.Position(doc.lineCount - 1, 6);
      const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        docUri,
        pos
      );
      const labels = (completions?.items ?? []).map((i) => (typeof i.label === "string" ? i.label : i.label.label));
      assert.ok(labels.includes("single_paired"), `Expected 'single_paired' in completions, got: ${labels.join(", ")}`);
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

    test("Changing validation profile shows IWC diagnostics then clears on reset", async () => {
      // Fixture satisfies schema (inputs/outputs/steps present) but omits the
      // IWC-required release/creator/license/doc and step-level doc — so it's
      // clean under basic and dirty under iwc. Asserts presence by message
      // rather than exact ranges — ranges are brittle.
      const docUri = getDocUri(path.join("yaml", "validation", "test_wf_iwc_missing.gxwf.yml"));
      await activateAndOpenInEditor(docUri);
      await sleep(500);
      await assertDiagnostics(docUri, []); // clean under basic

      await updateSettings("validation.profile", "iwc");
      await waitForDiagnostics(docUri);
      const iwcDiags = vscode.languages.getDiagnostics(docUri);
      const find = (msg: string): vscode.Diagnostic | undefined => iwcDiags.find((d) => d.message.includes(msg));
      const release = find("must have a release version");
      const creator = find("does not specify a creator");
      const license = find("does not specify a license");
      const doc = find("is not documented");
      assert.ok(
        release && creator && license && doc,
        `Expected IWC diagnostics, got: ${iwcDiags.map((d) => d.message).join(" | ")}`
      );
      assert.strictEqual(release!.severity, vscode.DiagnosticSeverity.Error);
      assert.strictEqual(creator!.severity, vscode.DiagnosticSeverity.Warning);
      assert.strictEqual(license!.severity, vscode.DiagnosticSeverity.Warning);

      await resetSettings();
      await waitForDiagnostics(docUri);
      await assertDiagnostics(docUri, []); // clean again
    });
  });
});
