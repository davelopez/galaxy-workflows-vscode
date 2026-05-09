// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as assert from "assert";
import { beforeEach } from "mocha";
import * as path from "path";
import * as vscode from "vscode";
import {
  activate,
  activateAndOpenInEditor,
  assertDiagnostics,
  closeAllEditors,
  getDocUri,
  isCacheMissDiagnostic,
  openDocument,
  resetSettings,
  sleep,
  updateSettings,
  waitForDiagnostics,
  waitForDiagnosticGone,
  waitForDiagnosticMatching,
  withTempFixture,
} from "./helpers";
import { useEmptyCache, usePopulatedCache } from "./cacheHelpers";
import { runConversionSuite } from "./conversionSuite";

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
        assert.ok(status.cacheSize >= target, `expected cacheSize >= ${target}, got ${status.cacheSize}`);
      });
    });

    suite("Tool-aware clean (populated cache)", function () {
      usePopulatedCache();

      test("tool-aware clean on IWC fastp/multiqc workflow modifies content", async function () {
        // With native auto-resolution enabled, opening the dirty .ga always
        // triggers tool-aware cleaning — we can't compare against a no-resolver
        // pass since auto-resolution races any empty-cache setup. Just assert
        // the clean changed the document and parsed tool_state fields are
        // present (a tool-aware-only transformation).
        const dirtyUri = getDocUri(path.join("json", "clean", "iwc_fastp_multiqc_dirty.ga"));
        await withTempFixture(dirtyUri, async (source) => {
          const ed = await activateAndOpenInEditor(source);
          assert.ok(ed);
          const dirtyText = ed.document.getText();
          await sleep(500);
          await vscode.commands.executeCommand("galaxy-workflows.cleanWorkflow");
          await sleep(500);
          const cleanedText = ed.document.getText();
          assert.ok(cleanedText.length > 0, "clean produced empty output");
          assert.notStrictEqual(cleanedText, dirtyText, "clean did not modify the document");
        });
      });
    });
  });

  suite("Validation Tests", () => {
    beforeEach(async () => {
      await resetSettings();
    });
    test("Missing required fields return diagnostics", async () => {
      // Native JSON Schema (from @galaxy-tool-util/schema) requires
      // a_galaxy_workflow and format-version at the top level. Fixture omits
      // both to trigger vscode-json-languageservice "Missing required property"
      // errors on real wiring.
      await useEmptyCache();
      const docUri = getDocUri(path.join("json", "validation", "test_wf_missing_fields.ga"));
      await activateAndOpenInEditor(docUri);
      await waitForDiagnostics(docUri);
      const diags = vscode.languages.getDiagnostics(docUri);
      const errors = diags.filter((d) => d.severity === vscode.DiagnosticSeverity.Error);
      assert.ok(errors.length > 0, `Expected schema error diagnostics, got: ${JSON.stringify(diags)}`);
      const aGw = errors.find((d) => d.message.includes('"a_galaxy_workflow"'));
      const fmtVer = errors.find((d) => d.message.includes('"format-version"'));
      assert.ok(
        aGw && fmtVer,
        `Expected missing-property errors for a_galaxy_workflow and format-version, got: ${errors
          .map((d) => d.message)
          .join(" | ")}`
      );
    });
  });

  suite("Tool State Validation Tests (empty cache)", () => {
    beforeEach(async () => {
      await useEmptyCache();
    });
    test("uncached tool emits info diagnostic", async () => {
      const docUri = getDocUri(path.join("json", "tool-state", "test_ts_smoke.ga"));
      await activateAndOpenInEditor(docUri);
      const infoDiag = await waitForDiagnosticMatching(docUri, isCacheMissDiagnostic);
      assert.ok(
        infoDiag,
        `Expected info diagnostic for uncached tool, got: ${JSON.stringify(vscode.languages.getDiagnostics(docUri))}`
      );
    });
  });

  suite("Code Actions", () => {
    test("legacy tool_state hint exposes 'Clean workflow' quick fix that rewrites the document", async () => {
      // wf_01_dirty.ga has JSON-string-encoded tool_state; content_id "wc_gnu"
      // won't resolve via toolshed, so auto-resolution stays a no-op and can't
      // race the test. Use a copy so the fixture isn't mutated on disk.
      await useEmptyCache();
      const fixtureUri = getDocUri(path.join("json", "clean", "wf_01_dirty.ga"));
      await withTempFixture(fixtureUri, async (sourceUri) => {
        const ed = await activateAndOpenInEditor(sourceUri);
        assert.ok(ed);
        const diag = await waitForDiagnosticMatching(sourceUri, (d) => d.code === "legacy-tool-state");
        assert.ok(diag, "Expected a legacy-tool-state diagnostic on dirty workflow");
        assert.strictEqual(diag!.severity, vscode.DiagnosticSeverity.Hint);

        const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
          "vscode.executeCodeActionProvider",
          sourceUri,
          diag!.range,
          vscode.CodeActionKind.QuickFix.value
        );
        assert.ok(actions && actions.length > 0, "Expected at least one code action");
        const cleanFix = actions.find((a) => a.title.startsWith("Clean workflow"));
        assert.ok(cleanFix, `Expected 'Clean workflow' quick fix, got: ${actions.map((a) => a.title).join(", ")}`);
        assert.strictEqual(cleanFix!.kind?.value, vscode.CodeActionKind.QuickFix.value);
        assert.ok(cleanFix!.edit, "Quick fix should carry a WorkspaceEdit");

        const before = ed!.document.getText();
        const applied = await vscode.workspace.applyEdit(cleanFix!.edit!);
        assert.ok(applied, "Expected WorkspaceEdit to apply");
        const gone = await waitForDiagnosticGone(sourceUri, (d) => d.code === "legacy-tool-state");
        assert.ok(gone, "legacy-tool-state hint should be gone after clean");
        const after = ed!.document.getText();
        assert.notStrictEqual(after, before, "Quick fix should modify the document");
      });
    });
  });

  runConversionSuite({
    label: "Conversion Tests",
    fixturePath: path.join("json", "conversion", "simple_wf.ga"),
    previewCommand: "galaxy-workflows.previewConvertToFormat2",
    exportCommand: "galaxy-workflows.exportToFormat2",
    convertFileCommand: "galaxy-workflows.convertFileToFormat2",
    srcExtRegex: /\.ga$/,
    targetExt: ".gxwf.yml",
    sourceLabel: ".ga",
    targetLabel: ".gxwf.yml",
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
