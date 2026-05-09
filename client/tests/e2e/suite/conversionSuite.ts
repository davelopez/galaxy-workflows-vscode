import * as assert from "assert";
import * as vscode from "vscode";
import { activateAndOpenInEditor, getDocUri, sleep, withTempFixture } from "./helpers";

export interface ConversionSuiteOptions {
  label: string;
  fixturePath: string; // relative path passed to getDocUri
  previewCommand: string;
  exportCommand: string;
  convertFileCommand: string;
  // Regex replacing the source extension with the target extension.
  srcExtRegex: RegExp;
  targetExt: string;
  sourceLabel: string; // human-readable source file ext, e.g. ".ga"
  targetLabel: string; // human-readable target file ext, e.g. ".gxwf.yml"
}

export function runConversionSuite(opts: ConversionSuiteOptions): void {
  suite(opts.label, () => {
    const fixtureUri = getDocUri(opts.fixturePath);
    const targetFor = (uri: vscode.Uri): vscode.Uri =>
      uri.with({ path: uri.path.replace(opts.srcExtRegex, opts.targetExt) });

    test(`${opts.previewCommand.split(".").pop()} opens diff view with converted content`, async () => {
      await activateAndOpenInEditor(fixtureUri);
      await sleep(500);
      await vscode.commands.executeCommand(opts.previewCommand);
      await sleep(1000);
      const hasConvertedEditor = vscode.window.visibleTextEditors.some(
        (e) => e.document.uri.scheme === "galaxy-converted-workflow"
      );
      assert.ok(hasConvertedEditor, "Expected galaxy-converted-workflow virtual document to be open");
    });

    test(`${opts.exportCommand.split(".").pop()} creates ${opts.targetLabel} alongside original`, async () => {
      await withTempFixture(
        fixtureUri,
        async (sourceUri) => {
          const targetUri = targetFor(sourceUri);
          await activateAndOpenInEditor(sourceUri);
          await sleep(500);
          await vscode.commands.executeCommand(opts.exportCommand);
          await sleep(1000);
          const stat = await vscode.workspace.fs.stat(targetUri);
          assert.ok(stat.size > 0, `Exported ${opts.targetLabel} should have content`);
          // Original should still exist
          await vscode.workspace.fs.stat(sourceUri);
        },
        (sourceUri) => [targetFor(sourceUri)]
      );
    });

    test(`${opts.convertFileCommand.split(".").pop()} replaces ${opts.sourceLabel} with ${
      opts.targetLabel
    }`, async () => {
      await withTempFixture(
        fixtureUri,
        async (sourceUri) => {
          const targetUri = targetFor(sourceUri);
          await activateAndOpenInEditor(sourceUri);
          await sleep(500);
          await vscode.commands.executeCommand(opts.convertFileCommand, { confirmed: true });
          await sleep(1000);
          const stat = await vscode.workspace.fs.stat(targetUri);
          assert.ok(stat.size > 0, `Converted ${opts.targetLabel} should have content`);
          let sourceGone = false;
          try {
            await vscode.workspace.fs.stat(sourceUri);
          } catch {
            sourceGone = true;
          }
          assert.ok(sourceGone, `Original ${opts.sourceLabel} should have been deleted after conversion`);
        },
        (sourceUri) => [targetFor(sourceUri)]
      );
    });
  });
}
