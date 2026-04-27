import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import {
  activate,
  activateAndOpenInEditor,
  closeAllEditors,
  getDocUri,
  openDocument,
  withTempFixture,
} from "./helpers";

interface RenderResult {
  contents: string;
  error?: string;
}

interface ExtensionApi {
  nativeClient: { sendRequest: <T>(id: string, params?: unknown) => Promise<T> };
  gxFormat2Client: { sendRequest: <T>(id: string, params?: unknown) => Promise<T> };
}

const REQUEST_ID = "galaxy-workflows-ls.renderWorkflowDiagram";

async function readFixture(rel: string): Promise<string> {
  const uri = getDocUri(rel);
  const doc = await openDocument(uri);
  assert.ok(doc, `failed to open fixture ${rel}`);
  return doc.getText();
}

suite("Diagram Preview — LSP wire", () => {
  teardown(closeAllEditors);

  test("native .ga renders as mermaid 'graph LR' via the native client", async () => {
    const api = (await activate()) as ExtensionApi;
    const contents = await readFixture("sample_workflow_1.ga");
    const result = await api.nativeClient.sendRequest<RenderResult>(REQUEST_ID, {
      contents,
      format: "mermaid",
      options: { comments: true },
    });
    assert.ok(result, "no result returned");
    assert.strictEqual(result.error, undefined, `unexpected error: ${result.error}`);
    assert.ok(result.contents.startsWith("graph LR"), `expected 'graph LR' prefix, got: ${result.contents.slice(0, 80)}`);
  });

  test("format2 .gxwf.yml renders as mermaid 'graph LR' via the format2 client", async () => {
    const api = (await activate()) as ExtensionApi;
    const contents = await readFixture(path.join("yaml", "conversion", "simple_wf.gxwf.yml"));
    const result = await api.gxFormat2Client.sendRequest<RenderResult>(REQUEST_ID, {
      contents,
      format: "mermaid",
      options: { comments: true },
    });
    assert.ok(result, "no result returned");
    assert.strictEqual(result.error, undefined, `unexpected error: ${result.error}`);
    assert.ok(result.contents.startsWith("graph LR"), `expected 'graph LR' prefix, got: ${result.contents.slice(0, 80)}`);
    assert.ok(result.contents.includes("input_"), "expected at least one input node");
  });

  test("malformed contents returns a typed error rather than throwing", async () => {
    const api = (await activate()) as ExtensionApi;
    const result = await api.nativeClient.sendRequest<RenderResult>(REQUEST_ID, {
      contents: "{ this is not valid json",
      format: "mermaid",
    });
    assert.ok(result, "no result returned");
    assert.strictEqual(result.contents, "");
    assert.ok(result.error && result.error.length > 0, "expected non-empty error message");
  });

  test("cytoscape format reports 'not yet implemented' (stub case)", async () => {
    const api = (await activate()) as ExtensionApi;
    const contents = await readFixture("sample_workflow_1.ga");
    const result = await api.nativeClient.sendRequest<RenderResult>(REQUEST_ID, {
      contents,
      format: "cytoscape",
    });
    assert.ok(result, "no result returned");
    assert.strictEqual(result.contents, "");
    assert.ok(result.error && /not yet implemented/i.test(result.error), `expected stub error, got: ${result.error}`);
  });

  // File-modifying test runs last — opening a temp .gxwf.yml + closeAllEditors
  // teardown can disturb language client state for subsequent tests in the same suite.
  test("exportMermaid writes <stem>.mmd alongside the source (format2)", async () => {
    const fixtureUri = getDocUri(path.join("yaml", "conversion", "simple_wf.gxwf.yml"));
    await withTempFixture(
      fixtureUri,
      async (sourceUri) => {
        await activateAndOpenInEditor(sourceUri);
        await new Promise((r) => setTimeout(r, 500));
        await vscode.commands.executeCommand("galaxy-workflows.exportMermaid");
        await new Promise((r) => setTimeout(r, 1000));

        const exportedUri = sourceUri.with({
          path: sourceUri.path.replace(/\.gxwf\.(yml|yaml)$/, ".mmd"),
        });
        const stat = await vscode.workspace.fs.stat(exportedUri);
        assert.ok(stat.size > 0, "exported .mmd should have content");
        const bytes = await vscode.workspace.fs.readFile(exportedUri);
        const content = new TextDecoder().decode(bytes);
        assert.ok(content.startsWith("graph LR"), `expected mermaid output, got: ${content.slice(0, 80)}`);
      },
      (sourceUri) => [sourceUri.with({ path: sourceUri.path.replace(/\.gxwf\.(yml|yaml)$/, ".mmd") })]
    );
  });
});
