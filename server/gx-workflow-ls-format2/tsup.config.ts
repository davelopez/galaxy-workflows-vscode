import { defineConfig } from "tsup";
import path from "path";
import { readFileSync } from "fs";
import { parse } from "yaml";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const schemasDir = path.resolve(__dirname, "../../workflow-languages/schemas");

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

const baseEsbuildOptions = (options: { alias?: Record<string, string>; mainFields?: string[]; conditions?: string[] }) => {
  options.alias = { "@schemas": schemasDir };
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
