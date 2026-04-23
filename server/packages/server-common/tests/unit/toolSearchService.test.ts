import { describe, it, expect, vi } from "vitest";
import type {
  GalaxyWorkflowLanguageServer,
  GetStepSkeletonParams,
  GetStepSkeletonResult,
  ParsedTool,
  SearchToolsParams,
  SearchToolsResult,
  ToolRegistryService,
} from "../../src/languageTypes";
import { LSRequestIdentifiers } from "../../src/languageTypes";
import { ToolSearchLspService } from "../../src/services/toolSearchService";

interface FakeSearchService {
  searchTools: ReturnType<typeof vi.fn>;
  getLatestVersionForToolId: ReturnType<typeof vi.fn>;
}

function makeHit(overrides: Record<string, unknown> = {}) {
  return {
    source: { type: "toolshed" as const, url: "https://toolshed.g2.bx.psu.edu" },
    toolId: "fastp",
    toolName: "fastp",
    toolDescription: "quality control",
    repoName: "fastp",
    repoOwnerUsername: "iuc",
    score: 12.3,
    trsToolId: "iuc~fastp~fastp",
    fullToolId: "toolshed.g2.bx.psu.edu/repos/iuc/fastp/fastp",
    ...overrides,
  };
}

function setup(opts: {
  search?: Partial<FakeSearchService>;
  registry?: Partial<ToolRegistryService>;
} = {}): {
  searchHandler: (p: SearchToolsParams) => Promise<SearchToolsResult>;
  skeletonHandler: (p: GetStepSkeletonParams) => Promise<GetStepSkeletonResult>;
  fakeSearch: FakeSearchService;
} {
  const fakeSearch: FakeSearchService = {
    searchTools: vi.fn(async () => [makeHit()]),
    getLatestVersionForToolId: vi.fn(async () => "1.1.0+galaxy0"),
    ...opts.search,
  };

  const baseTool: ParsedTool = {
    id: "fastp",
    name: "fastp",
    description: "quality control",
    version: "1.1.0+galaxy0",
    inputs: [],
    outputs: [],
  } as unknown as ParsedTool;

  const reg: ToolRegistryService = {
    async hasCached() {
      return true;
    },
    async listCached() {
      return [];
    },
    async populateCache() {
      return { fetched: 0, alreadyCached: 1, failed: [] };
    },
    configure() {
      /* noop */
    },
    async getCacheSize() {
      return 0;
    },
    async getToolParameters() {
      return [];
    },
    async getToolInfo() {
      return baseTool;
    },
    getToolShedBaseUrl() {
      return "https://toolshed.g2.bx.psu.edu";
    },
    hasResolutionFailed() {
      return false;
    },
    markResolutionFailed() {
      /* noop */
    },
    clearResolutionFailed() {
      /* noop */
    },
    async validateNativeStep() {
      return [];
    },
    getSearchService() {
      return fakeSearch as never;
    },
    ...opts.registry,
  };

  const handlers = new Map<string, (params: unknown) => unknown>();
  const server = {
    connection: {
      onRequest: (name: string, cb: (params: unknown) => unknown) => {
        handlers.set(name, cb);
      },
      sendNotification: () => {
        /* noop */
      },
    },
    toolRegistryService: reg,
    documentsCache: { get: () => undefined, all: () => [] },
    autoResolutionEnabled: false,
    revalidateDocument: () => {
      /* noop */
    },
  } as unknown as GalaxyWorkflowLanguageServer;

  new ToolSearchLspService(server);
  const searchHandler = handlers.get(LSRequestIdentifiers.SEARCH_TOOLS);
  const skeletonHandler = handlers.get(LSRequestIdentifiers.GET_STEP_SKELETON);
  if (!searchHandler || !skeletonHandler) throw new Error("handlers not registered");
  return {
    searchHandler: searchHandler as (p: SearchToolsParams) => Promise<SearchToolsResult>,
    skeletonHandler: skeletonHandler as (p: GetStepSkeletonParams) => Promise<GetStepSkeletonResult>,
    fakeSearch,
  };
}

describe("SEARCH_TOOLS handler", () => {
  it("flattens NormalizedToolHit into wire ToolSearchHit", async () => {
    const { searchHandler, fakeSearch } = setup();
    const result = await searchHandler({ query: "fastp" });
    expect(fakeSearch.searchTools).toHaveBeenCalledWith("fastp", expect.objectContaining({ maxResults: 51 }));
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]).toMatchObject({
      toolshedUrl: "https://toolshed.g2.bx.psu.edu",
      trsToolId: "iuc~fastp~fastp",
      fullToolId: "toolshed.g2.bx.psu.edu/repos/iuc/fastp/fastp",
      toolName: "fastp",
    });
    expect(result.truncated).toBe(false);
  });

  it("marks truncated when more hits than maxResults are returned", async () => {
    const { searchHandler } = setup({
      search: { searchTools: vi.fn(async () => Array.from({ length: 11 }, (_, i) => makeHit({ toolId: `t${i}` }))) },
    });
    const result = await searchHandler({ query: "anything", maxResults: 10 });
    expect(result.hits).toHaveLength(10);
    expect(result.truncated).toBe(true);
  });

  it("returns empty result when search service is unavailable", async () => {
    const { searchHandler } = setup({
      registry: {
        getSearchService: () => undefined,
      },
    });
    const result = await searchHandler({ query: "anything" });
    expect(result).toEqual({ hits: [], truncated: false });
  });
});

describe("GET_STEP_SKELETON handler", () => {
  it("resolves latest version when omitted and returns a step", async () => {
    const { skeletonHandler, fakeSearch } = setup();
    const result = await skeletonHandler({
      toolshedUrl: "https://toolshed.g2.bx.psu.edu",
      trsToolId: "iuc~fastp~fastp",
      format: "native",
    });
    expect(fakeSearch.getLatestVersionForToolId).toHaveBeenCalledWith(
      "https://toolshed.g2.bx.psu.edu",
      "iuc~fastp~fastp"
    );
    expect(result.error).toBeUndefined();
    expect(result.step).toBeDefined();
  });

  it("errors when version cannot be resolved", async () => {
    const { skeletonHandler } = setup({
      search: { getLatestVersionForToolId: vi.fn(async () => null) },
    });
    const result = await skeletonHandler({
      toolshedUrl: "https://toolshed.g2.bx.psu.edu",
      trsToolId: "iuc~fastp~fastp",
      format: "native",
    });
    expect(result.error).toContain("No version");
    expect(result.step).toBeNull();
  });

  it("errors when tool cannot be loaded from cache after populate", async () => {
    const { skeletonHandler } = setup({
      registry: { getToolInfo: async () => null },
    });
    const result = await skeletonHandler({
      toolshedUrl: "https://toolshed.g2.bx.psu.edu",
      trsToolId: "iuc~fastp~fastp",
      version: "1.1.0+galaxy0",
      format: "format2",
    });
    expect(result.error).toContain("could not be resolved");
  });
});
