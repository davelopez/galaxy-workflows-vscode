import "reflect-metadata";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { FilesystemCacheStorage } from "@galaxy-tool-util/core/node";
import { ToolInfoService } from "@galaxy-tool-util/core";
import { ToolRegistryServiceImpl } from "../../src/providers/toolRegistry";

const TOOLSHED_URL = "https://toolshed.g2.bx.psu.edu";
const TOOL_ID = "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed/2.31.1";
const TOOL_VERSION = "2.31.1";

// Minimal ParsedTool shape that decodes cleanly via Effect Schema.
const MINIMAL_TOOL = {
  id: "bedtools_intersectbed",
  version: TOOL_VERSION,
  name: "BEDTools Intersect",
  description: null,
  inputs: [{ type: "data", name: "input_a" }],
  outputs: [],
  citations: [],
  license: null,
  profile: null,
  edam_operations: [],
  edam_topics: [],
  xrefs: [],
};

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tool-registry-test-"));
}

/** Seed a cache entry via ToolInfoService so key derivation + index stay in sync with upstream. */
async function seedTool(storage: FilesystemCacheStorage): Promise<void> {
  const svc = new ToolInfoService({ storage, defaultToolshedUrl: TOOLSHED_URL });
  await svc.addTool(TOOL_ID, TOOL_VERSION, MINIMAL_TOOL, "local", "");
}

describe("ToolRegistryServiceImpl resolution-failure tracking", () => {
  it("reports markResolutionFailed / hasResolutionFailed per (id, version)", () => {
    const registry = new ToolRegistryServiceImpl();
    expect(registry.hasResolutionFailed(TOOL_ID, TOOL_VERSION)).toBe(false);
    registry.markResolutionFailed(TOOL_ID, TOOL_VERSION);
    expect(registry.hasResolutionFailed(TOOL_ID, TOOL_VERSION)).toBe(true);
    expect(registry.hasResolutionFailed(TOOL_ID, "9.9.9")).toBe(false);
  });
});

describe("ToolRegistryServiceImpl filesystem cache", () => {
  let registry: ToolRegistryServiceImpl;
  let cacheDir: string;
  let storage: FilesystemCacheStorage;

  beforeEach(() => {
    cacheDir = makeTempDir();
    storage = new FilesystemCacheStorage(cacheDir);
    registry = new ToolRegistryServiceImpl();
    registry.configure({ toolShedUrl: TOOLSHED_URL, storage });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it("hasCached returns false for uncached tool", async () => {
    expect(await registry.hasCached(TOOL_ID, TOOL_VERSION)).toBe(false);
  });

  it("hasCached returns true after seeding", async () => {
    await seedTool(storage);
    expect(await registry.hasCached(TOOL_ID, TOOL_VERSION)).toBe(true);
  });

  it("listCached surfaces index entries", async () => {
    await seedTool(storage);
    const listed = await registry.listCached();
    expect(listed).toHaveLength(1);
    expect(listed[0].tool_version).toBe(TOOL_VERSION);
    expect(listed[0].tool_id).toContain("bedtools_intersectbed");
  });

  it("getCacheSize is 0 when empty", async () => {
    expect(await registry.getCacheSize()).toBe(0);
  });

  it("getCacheSize is 1 when seeded before first read", async () => {
    // CacheIndex memoizes after its first load, and seeding bypasses the
    // registry — so seed first, then read.
    const dir = makeTempDir();
    try {
      const seeded = new FilesystemCacheStorage(dir);
      await seedTool(seeded);
      const r = new ToolRegistryServiceImpl();
      r.configure({ toolShedUrl: TOOLSHED_URL, storage: new FilesystemCacheStorage(dir) });
      expect(await r.getCacheSize()).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("getToolParameters returns null when uncached", async () => {
    expect(await registry.getToolParameters(TOOL_ID, TOOL_VERSION)).toBeNull();
  });

  it("getToolParameters returns inputs when cached", async () => {
    await seedTool(storage);
    const inputs = await registry.getToolParameters(TOOL_ID, TOOL_VERSION);
    expect(inputs).toEqual(MINIMAL_TOOL.inputs);
  });

  it("getToolInfo returns null when uncached", async () => {
    expect(await registry.getToolInfo(TOOL_ID, TOOL_VERSION)).toBeNull();
  });

  it("getToolInfo returns the ParsedTool when cached", async () => {
    await seedTool(storage);
    const info = await registry.getToolInfo(TOOL_ID, TOOL_VERSION);
    expect(info).not.toBeNull();
    expect(info?.name).toBe(MINIMAL_TOOL.name);
    expect(info?.version).toBe(TOOL_VERSION);
  });

  it("getToolShedBaseUrl returns the configured url", () => {
    expect(registry.getToolShedBaseUrl()).toBe(TOOLSHED_URL);
  });
});

describe("populateCache", () => {
  let registry: ToolRegistryServiceImpl;
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = makeTempDir();
    registry = new ToolRegistryServiceImpl();
    registry.configure({ toolShedUrl: TOOLSHED_URL, storage: new FilesystemCacheStorage(cacheDir) });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it("returns empty result for empty input list", async () => {
    const result = await registry.populateCache([]);
    expect(result).toEqual({ fetched: 0, alreadyCached: 0, failed: [] });
  });

  it("reports failed for tools that fail to fetch (fetcher stubbed to error)", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("stubbed network error");
    }) as typeof fetch;
    try {
      const result = await registry.populateCache([
        { toolId: "toolshed.g2.bx.psu.edu/repos/iuc/notexist/notexist/9.99.9", toolVersion: "9.99.9" },
      ]);
      expect(result.fetched).toBe(0);
      expect(result.failed).toHaveLength(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
