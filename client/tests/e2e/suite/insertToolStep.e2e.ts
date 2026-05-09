// Hits the live Tool Shed. Skipped if the search round-trip fails (e.g.
// offline / shed outage) — mirrors the skip-on-offline pattern used by
// usePopulatedCache.
import * as assert from "assert";
import { before } from "mocha";
import * as path from "path";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { activate, activateAndOpenInEditor, closeAllEditors, getDocUri, sleep, withTempFixture } from "./helpers";
import { useEmptyCache } from "./cacheHelpers";

const SEARCH_TOOLS = "galaxy-workflows-ls.searchTools";
const INSERT_TOOL_STEP = "galaxy-workflows.insertToolStep";

interface ToolSearchHit {
  toolId: string;
  toolName: string;
  trsToolId: string;
  fullToolId: string;
  version?: string;
}
interface SearchToolsResult {
  hits: ToolSearchHit[];
  truncated: boolean;
}

async function probeToolShed(client: LanguageClient): Promise<boolean> {
  try {
    const result = await client.sendRequest<SearchToolsResult>(SEARCH_TOOLS, { query: "fastp", maxResults: 5 });
    return !!result && result.hits.length > 0;
  } catch {
    return false;
  }
}

suite("Insert Tool Step", function () {
  teardown(closeAllEditors);

  let shedReachable = false;
  before(async function () {
    this.timeout(30_000);
    await useEmptyCache();
    const api = (await activate()) as { nativeClient: LanguageClient };
    shedReachable = await probeToolShed(api.nativeClient);
    if (!shedReachable) {
      console.warn("Skipping Insert Tool Step suite: ToolShed search returned no hits for 'fastp'.");
      this.skip();
    }
  });

  test("inserts a fastp step into a native .ga workflow", async function () {
    this.timeout(120_000);
    const fixture = getDocUri(path.join("json", "clean", "wf_01_clean.ga"));
    await withTempFixture(fixture, async (tempUri) => {
      const ed = await activateAndOpenInEditor(tempUri);
      assert.ok(ed);
      await sleep(500);

      const beforeText = ed.document.getText();
      const beforeSteps = Object.keys((JSON.parse(beforeText) as { steps: Record<string, unknown> }).steps);

      await vscode.commands.executeCommand(INSERT_TOOL_STEP, {
        query: "fastp",
        autoPickToolIdContains: "fastp",
      });
      await sleep(500);

      const afterText = ed.document.getText();
      assert.notStrictEqual(afterText, beforeText, "document text unchanged after insert");
      const afterDoc = JSON.parse(afterText) as { steps: Record<string, { tool_id?: unknown }> };
      const afterSteps = Object.keys(afterDoc.steps);
      assert.strictEqual(afterSteps.length, beforeSteps.length + 1, "expected exactly one step appended");

      const newStepKey = afterSteps.find((k) => !beforeSteps.includes(k));
      assert.ok(newStepKey, "could not identify newly inserted step key");
      const newStep = afterDoc.steps[newStepKey!];
      assert.ok(
        typeof newStep.tool_id === "string" && newStep.tool_id.includes("fastp"),
        `expected new step tool_id to contain 'fastp', got ${JSON.stringify(newStep.tool_id)}`
      );
    });
  });

  test("inserts a fastp step into a format2 .gxwf.yml workflow", async function () {
    this.timeout(120_000);
    const fixture = getDocUri(path.join("yaml", "conversion", "simple_wf.gxwf.yml"));
    await withTempFixture(fixture, async (tempUri) => {
      const ed = await activateAndOpenInEditor(tempUri);
      assert.ok(ed);
      await sleep(500);

      const beforeText = ed.document.getText();

      await vscode.commands.executeCommand(INSERT_TOOL_STEP, {
        query: "fastp",
        autoPickToolIdContains: "fastp",
      });
      await sleep(500);

      const afterText = ed.document.getText();
      assert.notStrictEqual(afterText, beforeText, "document text unchanged after insert");
      assert.ok(/fastp/.test(afterText), "expected fastp tool_id in updated document");
      // Sanity-check we produced YAML, not JSON (no outer braces, has a tool_id key).
      assert.ok(!/^\s*\{/.test(afterText), "document should not start with a JSON brace");
      assert.ok(/\btool_id\b/.test(afterText), "expected tool_id key in updated document");
    });
  });
});
