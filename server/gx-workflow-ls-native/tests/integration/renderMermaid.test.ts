import "reflect-metadata";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { NativeWorkflowLanguageServiceImpl } from "../../src/languageService";

function makeRegistry(): ToolRegistryService {
  return {
    hasCached: async () => false,
    listCached: async () => [],
    populateCache: async () => ({ fetched: 0, alreadyCached: 0, failed: [] }),
    configure: () => undefined,
    getCacheSize: async () => 0,
    getToolParameters: async () => null,
    hasResolutionFailed: () => false,
    markResolutionFailed: () => undefined,
    clearResolutionFailed: () => undefined,
    getToolInfo: async () => null,
    getToolShedBaseUrl: () => undefined,
    validateNativeStep: async () => [],
  };
}

function makeService(): NativeWorkflowLanguageServiceImpl {
  return new NativeWorkflowLanguageServiceImpl({ getSymbols: () => [] }, makeRegistry());
}

const FIXTURE = resolve(__dirname, "../../../../test-data/sample_workflow_1.ga");

describe("NativeWorkflowLanguageServiceImpl.renderDiagram", () => {
  it("renders a mermaid graph for a native .ga workflow", async () => {
    const text = readFileSync(FIXTURE, "utf8");
    const result = await makeService().renderDiagram(text, "mermaid");
    expect(result.startsWith("graph LR")).toBe(true);
    expect(result).toContain("step_");
  });

  it("forwards comments option", async () => {
    const text = readFileSync(FIXTURE, "utf8");
    const result = await makeService().renderDiagram(text, "mermaid", { comments: true });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("throws for cytoscape format (not yet implemented)", async () => {
    const text = readFileSync(FIXTURE, "utf8");
    await expect(makeService().renderDiagram(text, "cytoscape")).rejects.toThrow(/not yet implemented/i);
  });
});
