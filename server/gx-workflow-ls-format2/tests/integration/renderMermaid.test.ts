import "reflect-metadata";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { getLanguageService } from "@gxwf/yaml-language-service/src";
import { GxFormat2WorkflowLanguageServiceImpl } from "../../src/languageService";

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

function makeService(): GxFormat2WorkflowLanguageServiceImpl {
  const yamlLs = getLanguageService();
  return new GxFormat2WorkflowLanguageServiceImpl(yamlLs as never, { getSymbols: () => [] }, makeRegistry());
}

const FIXTURE = resolve(__dirname, "../../../../test-data/yaml/conversion/simple_wf.gxwf.yml");

describe("GxFormat2WorkflowLanguageServiceImpl.renderDiagram", () => {
  it("renders a mermaid graph for a format2 workflow", async () => {
    const text = readFileSync(FIXTURE, "utf8");
    const result = await makeService().renderDiagram(text, "mermaid");
    expect(result.startsWith("graph LR")).toBe(true);
    expect(result).toContain("input_");
  });

  it("throws for cytoscape format (not yet implemented)", async () => {
    const text = readFileSync(FIXTURE, "utf8");
    await expect(makeService().renderDiagram(text, "cytoscape")).rejects.toThrow(/not yet implemented/i);
  });
});
