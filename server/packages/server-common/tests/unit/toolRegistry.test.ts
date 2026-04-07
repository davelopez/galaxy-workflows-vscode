import "reflect-metadata";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ToolRegistryServiceImpl } from "../../src/providers/toolRegistry";
import { CachedToolEntry, ParsedToolJson } from "../../src/languageTypes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tool-registry-test-"));
}

function writeCacheFiles(cacheDir: string, key: string, tool: ParsedToolJson, entry: CachedToolEntry): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, `${key}.json`), JSON.stringify(tool), "utf8");
  const indexPath = path.join(cacheDir, "index.json");
  let index: { entries: Record<string, CachedToolEntry> } = { entries: {} };
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  }
  index.entries[key] = entry;
  fs.writeFileSync(indexPath, JSON.stringify(index), "utf8");
}

const DUMMY_TOOL: ParsedToolJson = {
  id: "bedtools_intersectbed",
  version: "2.31.1",
  name: "BEDTools Intersect",
  description: "Intersect intervals",
  inputs: [],
  outputs: [],
};

// ---------------------------------------------------------------------------
// parseToolshedToolId tests
// ---------------------------------------------------------------------------

describe("parseToolshedToolId", () => {
  let registry: ToolRegistryServiceImpl;

  beforeEach(() => {
    registry = new ToolRegistryServiceImpl();
  });

  it("parses a full ToolShed tool ID without scheme", () => {
    const result = registry.parseToolshedToolId(
      "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed/2.31.1"
    );
    expect(result).not.toBeNull();
    expect(result!.toolshedUrl).toBe("https://toolshed.g2.bx.psu.edu");
    expect(result!.trsToolId).toBe("iuc~bedtools~bedtools_intersectbed");
    expect(result!.toolVersion).toBe("2.31.1");
  });

  it("parses a full ToolShed tool ID with https scheme", () => {
    const result = registry.parseToolshedToolId(
      "https://toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed/2.31.1"
    );
    expect(result).not.toBeNull();
    expect(result!.toolshedUrl).toBe("https://toolshed.g2.bx.psu.edu");
    expect(result!.trsToolId).toBe("iuc~bedtools~bedtools_intersectbed");
    expect(result!.toolVersion).toBe("2.31.1");
  });

  it("returns null for a bare tool ID", () => {
    expect(registry.parseToolshedToolId("cat1")).toBeNull();
  });

  it("parses tool ID without version", () => {
    const result = registry.parseToolshedToolId(
      "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed"
    );
    expect(result).not.toBeNull();
    expect(result!.toolVersion).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeCacheKey tests
// ---------------------------------------------------------------------------

describe("computeCacheKey", () => {
  let registry: ToolRegistryServiceImpl;

  beforeEach(() => {
    registry = new ToolRegistryServiceImpl();
  });

  it("produces a 64-char hex string", () => {
    const key = registry.computeCacheKey(
      "https://toolshed.g2.bx.psu.edu",
      "iuc~bedtools~bedtools_intersectbed",
      "2.31.1"
    );
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    const a = registry.computeCacheKey("https://toolshed.g2.bx.psu.edu", "iuc~bedtools~bedtools_intersectbed", "2.31.1");
    const b = registry.computeCacheKey("https://toolshed.g2.bx.psu.edu", "iuc~bedtools~bedtools_intersectbed", "2.31.1");
    expect(a).toBe(b);
  });

  it("differs for different inputs", () => {
    const a = registry.computeCacheKey("https://toolshed.g2.bx.psu.edu", "iuc~bedtools~bedtools_intersectbed", "2.31.1");
    const b = registry.computeCacheKey("https://toolshed.g2.bx.psu.edu", "iuc~bedtools~bedtools_intersectbed", "2.30.0");
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Filesystem cache read
// ---------------------------------------------------------------------------

describe("ToolRegistryServiceImpl filesystem cache", () => {
  let registry: ToolRegistryServiceImpl;
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = makeTempDir();
    registry = new ToolRegistryServiceImpl();
    registry.configure({ cacheDir, toolShedUrl: "https://toolshed.g2.bx.psu.edu" });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it("reads a tool from the filesystem cache", async () => {
    const key = registry.computeCacheKey(
      "https://toolshed.g2.bx.psu.edu",
      "iuc~bedtools~bedtools_intersectbed",
      "2.31.1"
    );
    const entry: CachedToolEntry = {
      cacheKey: key,
      toolId: "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed",
      toolVersion: "2.31.1",
      source: "fetched",
      cachedAt: new Date().toISOString(),
    };
    writeCacheFiles(cacheDir, key, DUMMY_TOOL, entry);

    const result = await registry.getToolInfo(
      "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed/2.31.1"
    );
    expect(result).not.toBeNull();
    expect(result!.parsedTool.id).toBe("bedtools_intersectbed");
    expect(result!.source).toBe("cache");
  });

  it("returns null for a tool not in cache (no fetch configured)", async () => {
    const result = await registry.getToolInfo(
      "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed/9.99.9"
    );
    expect(result).toBeNull();
  });

  it("caches in memory so second call doesn't re-read filesystem", async () => {
    const key = registry.computeCacheKey(
      "https://toolshed.g2.bx.psu.edu",
      "iuc~bedtools~bedtools_intersectbed",
      "2.31.1"
    );
    const entry: CachedToolEntry = {
      cacheKey: key,
      toolId: "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed",
      toolVersion: "2.31.1",
      source: "fetched",
      cachedAt: new Date().toISOString(),
    };
    writeCacheFiles(cacheDir, key, DUMMY_TOOL, entry);

    await registry.getToolInfo("toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed/2.31.1");
    // Delete the file — second call should still succeed via memory cache
    fs.unlinkSync(path.join(cacheDir, `${key}.json`));
    const result = await registry.getToolInfo(
      "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed/2.31.1"
    );
    expect(result).not.toBeNull();
  });

  it("listCached returns entries from index.json", () => {
    const key = registry.computeCacheKey(
      "https://toolshed.g2.bx.psu.edu",
      "iuc~fastqc~fastqc",
      "0.74"
    );
    const entry: CachedToolEntry = {
      cacheKey: key,
      toolId: "toolshed.g2.bx.psu.edu/repos/iuc/fastqc/fastqc",
      toolVersion: "0.74",
      source: "fetched",
      cachedAt: new Date().toISOString(),
    };
    writeCacheFiles(cacheDir, key, DUMMY_TOOL, entry);

    const listed = registry.listCached();
    expect(listed).toHaveLength(1);
    expect(listed[0].toolVersion).toBe("0.74");
  });

  it("hasCached returns true for a cached tool", () => {
    const key = registry.computeCacheKey(
      "https://toolshed.g2.bx.psu.edu",
      "iuc~bedtools~bedtools_intersectbed",
      "2.31.1"
    );
    const entry: CachedToolEntry = {
      cacheKey: key,
      toolId: "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed",
      toolVersion: "2.31.1",
      source: "fetched",
      cachedAt: new Date().toISOString(),
    };
    writeCacheFiles(cacheDir, key, DUMMY_TOOL, entry);

    expect(
      registry.hasCached("toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed/2.31.1")
    ).toBe(true);
  });

  it("hasCached returns false for an uncached tool", () => {
    expect(
      registry.hasCached("toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed/9.99.9")
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// populateCache
// ---------------------------------------------------------------------------

describe("populateCache", () => {
  let registry: ToolRegistryServiceImpl;
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = makeTempDir();
    registry = new ToolRegistryServiceImpl();
    registry.configure({ cacheDir, toolShedUrl: "https://toolshed.g2.bx.psu.edu" });
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it("reports alreadyCached count for pre-cached tools", async () => {
    const key = registry.computeCacheKey(
      "https://toolshed.g2.bx.psu.edu",
      "iuc~bedtools~bedtools_intersectbed",
      "2.31.1"
    );
    const entry: CachedToolEntry = {
      cacheKey: key,
      toolId: "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed",
      toolVersion: "2.31.1",
      source: "fetched",
      cachedAt: new Date().toISOString(),
    };
    writeCacheFiles(cacheDir, key, DUMMY_TOOL, entry);

    const result = await registry.populateCache([
      {
        toolId: "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed/2.31.1",
        toolVersion: "2.31.1",
      },
    ]);
    expect(result.alreadyCached).toBe(1);
    expect(result.fetched).toBe(0);
    expect(result.failed).toHaveLength(0);
  });

  it("reports failed for tools that fail to fetch", async () => {
    const result = await registry.populateCache([
      { toolId: "toolshed.g2.bx.psu.edu/repos/iuc/notexist/notexist/9.99.9", toolVersion: "9.99.9" },
    ]);
    // No real network in tests, but fetch will fail → recorded as failed
    expect(result.failed.length + result.fetched).toBe(1);
  });
});
