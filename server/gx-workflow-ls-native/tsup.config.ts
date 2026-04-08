import { defineConfig } from "tsup";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const baseEsbuildOptions = (options: { alias?: Record<string, string>; mainFields?: string[]; conditions?: string[] }) => {
  // Use CJS ("main") first to avoid ESM-only exports in packages that ship both CJS and ESM.
  // "import" is added to handle @galaxy-tool-util/* which only expose an "import" export condition.
  options.mainFields = ["main", "module"];
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
