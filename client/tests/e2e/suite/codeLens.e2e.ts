import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { activateAndOpenInEditor, closeAllEditors, getDocUri, sleep } from "./helpers";
import { usePopulatedCache } from "./cacheHelpers";

suite("CodeLens on tool_id", function () {
  teardown(closeAllEditors);
  usePopulatedCache();

  test("emits one lens per tool step with tool name in title", async function () {
    this.timeout(30_000);
    const docUri = getDocUri(path.join("json", "clean", "iwc_fastp_multiqc_dirty.ga"));
    const ed = await activateAndOpenInEditor(docUri);
    assert.ok(ed);
    await sleep(500);

    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>("vscode.executeCodeLensProvider", docUri);
    assert.ok(lenses, "expected CodeLens array");
    // iwc_fastp_multiqc_dirty.ga has two tool steps.
    assert.strictEqual(lenses.length, 2, `expected 2 lenses, got ${lenses.length}`);

    const titles = lenses.map((l) => l.command?.title ?? "");
    assert.ok(
      titles.some((t) => t.includes("Open in ToolShed")),
      `expected at least one 'Open in ToolShed' lens, got: ${titles.join(" | ")}`
    );
    // Cached toolshed tools → openToolInToolShed command.
    const toolshedLens = lenses.find((l) => l.command?.command === "galaxy-workflows.openToolInToolShed");
    assert.ok(toolshedLens, "expected a toolshed lens with openToolInToolShed command");
    // Arguments payload carries toolId/toolVersion/toolshedUrl.
    const arg = toolshedLens!.command?.arguments?.[0] as { toolId?: string; toolshedUrl?: string } | undefined;
    assert.ok(arg?.toolId, "expected toolId in command arguments");
    assert.ok(arg?.toolshedUrl?.includes("/view/"), "expected toolshed URL in command arguments");
  });
});
