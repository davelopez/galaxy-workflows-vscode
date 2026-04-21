import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { activate, activateAndOpenInEditor, closeAllEditors, getDocUri, sleep } from "./helpers";
import { usePopulatedCache } from "./cacheHelpers";

const GET_WORKFLOW_TOOLS = "galaxy-workflows-ls.getWorkflowTools";

// Minimal shape of the GET_WORKFLOW_TOOLS response — kept local so this
// suite's tsconfig can enforce rootDir without reaching into ../../../src/.
interface WorkflowToolEntry {
  toolId: string;
  toolVersion?: string;
  cached: boolean;
  resolutionFailed: boolean;
  name?: string;
  toolshedUrl?: string;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
}
interface GetWorkflowToolsResult {
  tools: WorkflowToolEntry[];
}

suite("Workflow Tools tree view", function () {
  teardown(closeAllEditors);
  usePopulatedCache();

  test("GET_WORKFLOW_TOOLS returns enriched entries for IWC workflow", async function () {
    this.timeout(30_000);
    const api = (await activate()) as { nativeClient: LanguageClient };
    const docUri = getDocUri(path.join("json", "clean", "iwc_fastp_multiqc_dirty.ga"));
    const ed = await activateAndOpenInEditor(docUri);
    assert.ok(ed);
    // Let the server parse the doc.
    await sleep(500);

    const result = await api.nativeClient.sendRequest<GetWorkflowToolsResult>(GET_WORKFLOW_TOOLS, {
      uri: docUri.toString(),
    });
    assert.ok(result, "expected GET_WORKFLOW_TOOLS result");
    // iwc_fastp_multiqc_dirty.ga has two tool steps (fastp + multiqc).
    assert.strictEqual(result.tools.length, 2, `expected 2 tool entries, got ${result.tools.length}`);

    const fastp = result.tools.find((t) => t.toolId.includes("fastp"));
    const multiqc = result.tools.find((t) => t.toolId.includes("multiqc"));
    assert.ok(fastp, "expected fastp entry");
    assert.ok(multiqc, "expected multiqc entry");

    // Cache is pre-populated for both tools, so cached=true and name should be
    // filled in from the parsed ParsedTool.
    assert.strictEqual(fastp.cached, true);
    assert.ok(fastp.name && fastp.name.length > 0, `expected fastp name, got ${JSON.stringify(fastp)}`);
    assert.ok(fastp.toolshedUrl?.includes("/view/iuc/fastp"), `expected toolshed URL, got ${fastp.toolshedUrl}`);
    assert.ok(fastp.range, "expected tool_id range");
  });

  test("revealToolStep moves editor selection to the tool_id range", async function () {
    this.timeout(30_000);
    const api = (await activate()) as { nativeClient: LanguageClient };
    const docUri = getDocUri(path.join("json", "clean", "iwc_fastp_multiqc_dirty.ga"));
    const docEd = await activateAndOpenInEditor(docUri);
    assert.ok(docEd);
    await sleep(500);

    const result = await api.nativeClient.sendRequest<GetWorkflowToolsResult>(GET_WORKFLOW_TOOLS, {
      uri: docUri.toString(),
    });
    const entry: WorkflowToolEntry | undefined = result?.tools.find((t) => t.toolId.includes("fastp"));
    assert.ok(entry, "expected fastp entry");

    await vscode.commands.executeCommand("galaxy-workflows.revealToolStep", entry);
    // revealToolStep sets editor.selection to range.start.
    const sel = docEd.editor.selection;
    assert.strictEqual(sel.active.line, entry.range.start.line);
    assert.strictEqual(sel.active.character, entry.range.start.character);
  });
});
