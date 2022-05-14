// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as path from "path";
import * as assert from "assert";
import { activateAndOpenInEditor, getDocUri, closeAllEditors, openDocument, sleep } from "./helpers";

suite("Extension Test Suite", () => {
  teardown(closeAllEditors);
  suite("Native (JSON) Workflows", () => {
    suite("Commands Tests", () => {
      test("Clean workflow command removes non-essential properties", async () => {
        const dirtyDocUri = getDocUri(path.join("json", "clean", "wf_01_dirty.ga"));
        const cleanDocUri = getDocUri(path.join("json", "clean", "wf_01_clean.ga"));
        const { document } = await activateAndOpenInEditor(dirtyDocUri);
        const dirtyDoc = document.getText();
        await vscode.commands.executeCommand("galaxy-workflows.cleanWorkflow");
        await sleep(1000); // Wait for command to apply changes
        const actualCleanJson = document.getText();
        assert.notEqual(dirtyDoc, actualCleanJson);
        const expectedCleanDocument = await openDocument(cleanDocUri);
        const expectedCleanJson = expectedCleanDocument.getText();
        assert.strictEqual(actualCleanJson, expectedCleanJson);
      });
    });
  });
});
