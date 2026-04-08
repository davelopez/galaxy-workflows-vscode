import { defineConfig } from "tsup";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const baseEsbuildOptions = (options: { alias?: Record<string, string>; mainFields?: string[]; conditions?: string[] }) => {
  // Use ESM ("module") first so bundled packages like vscode-json-languageservice use their
  // static-import ESM build instead of the UMD build (which uses dynamic require() calls
  // that esbuild cannot resolve at bundle time).
  // @galaxy-tool-util/* uses the "exports"/"import" condition and is unaffected by mainFields.
  options.mainFields = ["module", "main"];
  options.conditions = ["require", "import", "node", "default"];
};

const browserEsbuildOptions = (options: { alias?: Record<string, string>; mainFields?: string[]; conditions?: string[] }) => {
  baseEsbuildOptions(options);
  // Shim Node.js built-ins used by yaml's CJS dist (require('process'), require('buffer'))
  options.alias = {
    ...options.alias,
    process: require.resolve("process/browser"),
    buffer: require.resolve("buffer/"),
  };
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
]);
