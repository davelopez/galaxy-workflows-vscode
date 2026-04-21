import { getLanguageService } from "vscode-json-languageservice";
import { TextDocument } from "../../src/languageTypes";
import { ASTNodeManager } from "../../src/ast/nodeManager";
import type { ToolRegistryService } from "../../src/languageTypes";
import { buildToolIdHover } from "../../src/providers/hover/toolIdHover";

function makeRegistry(): ToolRegistryService {
  return {
    async hasCached() { return false; },
    async listCached() { return []; },
    async populateCache() { return { fetched: 0, alreadyCached: 0, failed: [] }; },
    configure() { /* noop */ },
    async getCacheSize() { return 0; },
    async getToolParameters() { return null; },
    async getToolInfo() { return null; },
    getToolShedBaseUrl() { return undefined; },
    hasResolutionFailed() { return false; },
    markResolutionFailed() { /* noop */ },
    async validateNativeStep() { return []; },
  };
}

function buildManager(contents: string): ASTNodeManager {
  const textDoc = TextDocument.create("foo://bar.json", "json", 0, contents);
  const ls = getLanguageService({});
  const jsonDoc = ls.parseJSONDocument(textDoc);
  return new ASTNodeManager(textDoc, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    root: (jsonDoc as any).root,
    getNodeFromOffset: (offset: number) => jsonDoc.getNodeFromOffset(offset) as never,
    internalDocument: jsonDoc,
  });
}

describe("buildToolIdHover path detection", () => {
  it("returns null when offset is on the tool_id key (not value)", async () => {
    const json = `{"steps":{"0":{"tool_id":"xyz"}}}`;
    const manager = buildManager(json);
    const keyOffset = json.indexOf('"tool_id"') + 2; // inside key text
    const hover = await buildToolIdHover({ nodeManager: manager, offset: keyOffset, registry: makeRegistry() });
    expect(hover).toBeNull();
  });

  it("returns null when tool_id sits outside a steps block", async () => {
    const json = `{"metadata":{"tool_id":"xyz"}}`;
    const manager = buildManager(json);
    const offset = json.indexOf('"xyz"') + 2;
    const hover = await buildToolIdHover({ nodeManager: manager, offset, registry: makeRegistry() });
    expect(hover).toBeNull();
  });

  it("returns null for unrelated strings inside a step", async () => {
    const json = `{"steps":{"0":{"label":"hello"}}}`;
    const manager = buildManager(json);
    const offset = json.indexOf('"hello"') + 2;
    const hover = await buildToolIdHover({ nodeManager: manager, offset, registry: makeRegistry() });
    expect(hover).toBeNull();
  });

  it("hits the not-cached branch on a valid tool_id value", async () => {
    const json = `{"steps":{"0":{"tool_id":"xyz"}}}`;
    const manager = buildManager(json);
    const offset = json.indexOf('"xyz"') + 2;
    const hover = await buildToolIdHover({ nodeManager: manager, offset, registry: makeRegistry() });
    expect(hover).not.toBeNull();
    const text = (hover!.contents as { value: string }).value;
    expect(text).toContain("Tool not cached");
  });
});
