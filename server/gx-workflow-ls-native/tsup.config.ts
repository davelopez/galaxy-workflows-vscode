import { defineConfig } from "tsup";

const esbuildOptions = (options: { mainFields?: string[]; conditions?: string[] }) => {
  // Use CJS ("main") first to avoid ESM-only exports in packages that ship both CJS and ESM.
  // "import" is added to handle @galaxy-tool-util/* which only expose an "import" export condition.
  options.mainFields = ["main", "module"];
  options.conditions = ["require", "import", "node", "default"];
};

export default defineConfig([
  {
    entry: { nativeServer: "src/node/server.ts" },
    outDir: "dist",
    format: ["cjs"],
    platform: "node",
    noExternal: [/.*/],
    esbuildOptions,
    sourcemap: true,
    bundle: true,
  },
  {
    entry: { nativeServer: "src/browser/server.ts" },
    outDir: "dist/web",
    format: ["cjs"],
    platform: "browser",
    noExternal: [/.*/],
    esbuildOptions,
    sourcemap: true,
    bundle: true,
  },
]);
