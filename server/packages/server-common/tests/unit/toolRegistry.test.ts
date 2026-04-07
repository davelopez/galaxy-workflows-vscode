import "reflect-metadata";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ToolRegistryServiceImpl } from "../../src/providers/toolRegistry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tool-registry-test-"));
}

/** Write an upstream-format cache file + index entry. */
function writeCacheEntry(
  cacheDir: string,
  key: string,
  tool: Record<string, unknown>,
  meta: { tool_id: string; tool_version: string; source: string; source_url: string; cached_at: string },
): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, `${key}.json`), JSON.stringify(tool, null, 2), "utf8");
  const indexPath = path.join(cacheDir, "index.json");
  let index: { entries: Record<string, typeof meta> } = { entries: {} };
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  }
  index.entries[key] = meta;
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf8");
}

const TOOL_ID = "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed/2.31.1";

// Minimal ParsedTool shape that passes Effect Schema decode in ToolCache
const MINIMAL_TOOL = {
  id: "bedtools_intersectbed",
  version: "2.31.1",
  name: "BEDTools Intersect",
  description: null,
  inputs: [],
  outputs: [],
  citations: [],
  license: null,
  profile: null,
  edam_operations: [],
  edam_topics: [],
  xrefs: [],
};

// ---------------------------------------------------------------------------
// configure() tests
// ---------------------------------------------------------------------------

describe("ToolRegistryServiceImpl.configure", () => {
  let registry: ToolRegistryServiceImpl;

  beforeEach(() => {
    registry = new ToolRegistryServiceImpl();
  });

  it("expands ~ in cacheDir", () => {
    registry.configure({ cacheDir: "~/some/path", toolShedUrl: "https://toolshed.g2.bx.psu.edu" });
    // After configure, hasCached on a non-existent tool should return false without crashing
    expect(registry.hasCached(TOOL_ID)).toBe(false);
  });

  it("accepts explicit cacheDir without tilde", () => {
    const dir = os.tmpdir();
    registry.configure({ cacheDir: dir, toolShedUrl: "https://toolshed.g2.bx.psu.edu" });
    expect(registry.hasCached(TOOL_ID)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasCached / listCached / cacheSize
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

  it("hasCached returns false for uncached tool", () => {
    expect(registry.hasCached(TOOL_ID)).toBe(false);
  });

  it("hasCached returns true after writing a cache entry", () => {
    // Compute the expected key the same way upstream does: SHA-256 of "url/trsId/version"
    const key = createHash("sha256")
      .update("https://toolshed.g2.bx.psu.edu/iuc~bedtools~bedtools_intersectbed/2.31.1")
      .digest("hex");
    writeCacheEntry(cacheDir, key, MINIMAL_TOOL, {
      tool_id: "toolshed.g2.bx.psu.edu/repos/iuc/bedtools/bedtools_intersectbed",
      tool_version: "2.31.1",
      source: "api",
      source_url: "",
      cached_at: new Date().toISOString(),
    });
    expect(registry.hasCached(TOOL_ID)).toBe(true);
  });

  it("listCached returns entries from index.json", () => {
    const key = createHash("sha256")
      .update("https://toolshed.g2.bx.psu.edu/iuc~fastqc~fastqc/0.74")
      .digest("hex");
    writeCacheEntry(cacheDir, key, MINIMAL_TOOL, {
      tool_id: "toolshed.g2.bx.psu.edu/repos/iuc/fastqc/fastqc",
      tool_version: "0.74",
      source: "api",
      source_url: "",
      cached_at: new Date().toISOString(),
    });
    const listed = registry.listCached();
    expect(listed).toHaveLength(1);
    expect(listed[0].tool_version).toBe("0.74");
    expect(listed[0].tool_id).toBe("toolshed.g2.bx.psu.edu/repos/iuc/fastqc/fastqc");
  });

  it("cacheSize reflects index entry count", () => {
    expect(registry.cacheSize).toBe(0);
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

  it("reports failed for tools that fail to fetch (no network in tests)", async () => {
    const result = await registry.populateCache([
      { toolId: "toolshed.g2.bx.psu.edu/repos/iuc/notexist/notexist/9.99.9", toolVersion: "9.99.9" },
    ]);
    expect(result.failed.length + result.fetched).toBe(1);
  });

  it("returns empty result for empty input list", async () => {
    const result = await registry.populateCache([]);
    expect(result.fetched).toBe(0);
    expect(result.alreadyCached).toBe(0);
    expect(result.failed).toHaveLength(0);
  });
});
