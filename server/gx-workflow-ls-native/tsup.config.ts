import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { nativeServer: "src/node/server.ts" },
    outDir: "dist",
    format: ["cjs"],
    platform: "node",
    sourcemap: true,
    bundle: true,
  },
  {
    entry: { nativeServer: "src/browser/server.ts" },
    outDir: "dist/web",
    format: ["cjs"],
    platform: "browser",
    sourcemap: true,
    bundle: true,
  },
]);
