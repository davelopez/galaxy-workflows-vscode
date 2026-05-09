import { defineConfig } from "tsup";

const baseEsbuildOptions = (options: { mainFields?: string[]; conditions?: string[] }): void => {
  // Prefer ESM ("module") so bundled packages like vscode-json-languageservice use their
  // static-import ESM build instead of the UMD build (dynamic require() calls esbuild can't resolve).
  options.mainFields = ["module", "main"];
  options.conditions = ["require", "import", "node", "default"];
};

const browserEsbuildOptions = (options: { mainFields?: string[]; conditions?: string[] }): void => {
  options.mainFields = ["module", "main"];
  // "browser" first so @galaxy-tool-util/core's universal (browser-safe) entry is selected.
  options.conditions = ["browser", "import", "default"];
};

export default defineConfig([
  {
    entry: { nativeServer: "src/node/server.ts" },
    outDir: "dist",
    format: ["cjs"],
    platform: "node",
    noExternal: [/.*/],
    esbuildOptions: baseEsbuildOptions,
    sourcemap: true,
    bundle: true,
  },
  {
    entry: { nativeServer: "src/browser/server.ts" },
    outDir: "dist/web",
    format: ["cjs"],
    platform: "browser",
    noExternal: [/.*/],
    esbuildOptions: browserEsbuildOptions,
    sourcemap: true,
    bundle: true,
  },
  {
    entry: { populateTestCache: "scripts/populateTestCache.ts" },
    outDir: "dist",
    format: ["cjs"],
    platform: "node",
    noExternal: [/.*/],
    esbuildOptions: baseEsbuildOptions,
    sourcemap: true,
    bundle: true,
  },
]);
