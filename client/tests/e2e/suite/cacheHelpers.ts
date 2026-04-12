import { spawn } from "child_process";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { sleep, updateSettings } from "./helpers";

export interface ToolRef {
  toolId: string;
  toolVersion?: string;
}

// At runtime __dirname is client/out/tests/e2e/suite/ — 5 ups to repo root,
// then into client/tests/e2e/.cache/ for a stable location across runs.
const SHARED_CACHE_DIR = path.resolve(
  __dirname,
  "../../../../../client/tests/e2e/.cache/tool_info_cache"
);

// At runtime __dirname is client/out/tests/e2e/suite/ — 5 ups to repo root.
const POPULATE_SCRIPT = path.resolve(
  __dirname,
  "../../../../../server/gx-workflow-ls-native/dist/populateTestCache.js"
);

const DEFAULT_POPULATE_TIMEOUT_MS = 30_000;

// Tools the populated-cache suite expects to be available. Extend as new tests
// are added. Every entry must include a concrete toolVersion — the toolshed
// requires one.
export const STANDARD_TOOL_SET: ToolRef[] = [
  { toolId: "toolshed.g2.bx.psu.edu/repos/iuc/fastp/fastp", toolVersion: "1.1.0+galaxy0" },
  { toolId: "toolshed.g2.bx.psu.edu/repos/iuc/multiqc/multiqc", toolVersion: "1.33+galaxy0" },
];

export async function makeTempCacheDir(): Promise<string> {
  const dir = path.join(os.tmpdir(), `gxwf-e2e-cache-${crypto.randomBytes(6).toString("hex")}`);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

export async function useCacheDir(dir: string): Promise<void> {
  await updateSettings("toolCache.directory", dir);
  // Let ToolRegistryService.configure() finish rebuilding the ToolInfoService
  // and the server re-validate open documents.
  await sleep(500);
}

export async function useEmptyCache(): Promise<string> {
  const dir = await makeTempCacheDir();
  await useCacheDir(dir);
  return dir;
}

interface SharedCacheOk {
  ok: true;
  cacheDir: string;
}

interface SharedCacheErr {
  ok: false;
  reason: string;
}

export type SharedCacheResult = SharedCacheOk | SharedCacheErr;

export async function ensureSharedCache(
  tools: ToolRef[] = STANDARD_TOOL_SET,
  opts: { timeoutMs?: number } = {}
): Promise<SharedCacheResult> {
  if (process.env.GXWF_E2E_CACHE_CLEAN === "1") {
    await fs.promises.rm(SHARED_CACHE_DIR, { recursive: true, force: true });
  }
  await fs.promises.mkdir(SHARED_CACHE_DIR, { recursive: true });

  const missing = tools.filter((t) => !isToolInCache(SHARED_CACHE_DIR, t));
  if (missing.length === 0) return { ok: true, cacheDir: SHARED_CACHE_DIR };

  try {
    await runPopulateScript({
      cacheDir: SHARED_CACHE_DIR,
      tools: missing,
      timeoutMs: opts.timeoutMs ?? DEFAULT_POPULATE_TIMEOUT_MS,
    });
    return { ok: true, cacheDir: SHARED_CACHE_DIR };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

interface CacheIndexEntry {
  tool_id: string;
  tool_version: string;
}

// @galaxy-tool-util/core writes index.json as { entries: { [hash]: entry } }.
function readCacheEntries(dir: string): CacheIndexEntry[] {
  const indexPath = path.join(dir, "index.json");
  if (!fs.existsSync(indexPath)) return [];
  try {
    const raw = fs.readFileSync(indexPath, "utf8");
    const parsed = JSON.parse(raw) as { entries?: Record<string, CacheIndexEntry> };
    return parsed.entries ? Object.values(parsed.entries) : [];
  } catch {
    return [];
  }
}

function isToolInCache(dir: string, tool: ToolRef): boolean {
  return readCacheEntries(dir).some(
    (e) =>
      e.tool_id === tool.toolId &&
      (tool.toolVersion === undefined || e.tool_version === tool.toolVersion)
  );
}

// Poll a cache dir until every expected tool appears, or timeout. Matches by
// toolId suffix so callers can pass either the short form (…/fastp/fastp) or
// the versioned form (…/fastp/fastp/1.1.0+galaxy0) that lives inside .ga files.
export async function waitForCachedTools(
  dir: string,
  expectedToolIds: string[],
  timeoutMs = 30_000,
  pollMs = 500
): Promise<string[]> {
  const deadline = Date.now() + timeoutMs;
  let found: string[] = [];
  while (Date.now() < deadline) {
    const cached = readCacheEntries(dir).map((e) => e.tool_id);
    found = expectedToolIds.filter((id) => cached.some((c) => id === c || id.startsWith(`${c}/`)));
    if (found.length === expectedToolIds.length) return found;
    await sleep(pollMs);
  }
  return found;
}

interface RunPopulateArgs {
  cacheDir: string;
  tools: ToolRef[];
  timeoutMs: number;
  toolShedUrl?: string;
}

function runPopulateScript(args: RunPopulateArgs): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(POPULATE_SCRIPT)) {
      reject(new Error(`populate script not built: ${POPULATE_SCRIPT}`));
      return;
    }
    const payload = JSON.stringify({
      cacheDir: args.cacheDir,
      tools: args.tools,
      toolShedUrl: args.toolShedUrl,
    });
    const child = spawn(process.execPath, [POPULATE_SCRIPT, payload], { stdio: "inherit" });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`populate timeout after ${args.timeoutMs}ms`));
    }, args.timeoutMs);
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`populate exited ${code}`));
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
