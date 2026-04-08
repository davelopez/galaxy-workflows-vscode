import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { extension: "src/extension.ts" },
    outDir: "dist",
    format: ["cjs"],
    platform: "node",
    external: ["vscode"],
    noExternal: [/^vscode-/],
    sourcemap: true,
    bundle: true,
  },
  {
    entry: { extension: "src/browser/extension.ts" },
    outDir: "dist/web",
    format: ["cjs"],
    platform: "browser",
    external: ["vscode"],
    noExternal: [/^vscode-/],
    sourcemap: true,
    bundle: true,
  },
]);
