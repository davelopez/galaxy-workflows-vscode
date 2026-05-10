import { readFileSync } from "fs";
import { defineConfig } from "tsup";
import { parse } from "yaml";

const yamlPlugin = {
  name: "yaml",
  setup(build: { onLoad: (opts: object, cb: (args: { path: string }) => object) => void }) {
    build.onLoad({ filter: /\.ya?ml$/ }, (args) => {
      const contents = readFileSync(args.path, "utf8");
      return {
        contents: `module.exports = ${JSON.stringify(parse(contents))}`,
        loader: "js",
      };
    });
  },
};

const baseEsbuildOptions = (options: {
  alias?: Record<string, string>;
  mainFields?: string[];
  conditions?: string[];
}): void => {
  // Prefer ESM ("module") so bundled packages like vscode-json-languageservice use their
  // static-import ESM build instead of the UMD build (dynamic require() calls esbuild can't resolve).
  options.mainFields = ["module", "main"];
  options.conditions = ["require", "import", "node", "default"];
};

const browserEsbuildOptions = (options: {
  alias?: Record<string, string>;
  mainFields?: string[];
  conditions?: string[];
}): void => {
  options.mainFields = ["module", "main"];
  // "browser" first so @galaxy-tool-util/core's universal (browser-safe) entry is selected.
  options.conditions = ["browser", "import", "default"];
};

const sharedConfig = {
  format: ["cjs"] as const,
  sourcemap: true,
  bundle: true,
  noExternal: [/.*/],
  esbuildPlugins: [yamlPlugin],
};

export default defineConfig([
  {
    entry: { gxFormat2Server: "src/node/server.ts" },
    outDir: "dist",
    platform: "node",
    ...sharedConfig,
    esbuildOptions: baseEsbuildOptions,
  },
  {
    entry: { gxFormat2Server: "src/browser/server.ts" },
    outDir: "dist/web",
    platform: "browser",
    ...sharedConfig,
    esbuildOptions: browserEsbuildOptions,
  },
]);
