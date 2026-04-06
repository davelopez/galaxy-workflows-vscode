import { defineConfig } from "tsup";
import path from "path";
import { readFileSync } from "fs";
import { parse } from "yaml";

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

const sharedConfig = {
  format: ["cjs"] as const,
  sourcemap: true,
  bundle: true,
  esbuildPlugins: [yamlPlugin],
  esbuildOptions(options: { alias?: Record<string, string> }) {
    options.alias = { "@schemas": schemasDir };
  },
};

export default defineConfig([
  {
    entry: { gxFormat2Server: "src/node/server.ts" },
    outDir: "dist",
    platform: "node",
    ...sharedConfig,
  },
  {
    entry: { gxFormat2Server: "src/browser/server.ts" },
    outDir: "dist/web",
    platform: "browser",
    ...sharedConfig,
  },
]);
