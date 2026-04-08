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
  noExternal: [/.*/],
  esbuildPlugins: [yamlPlugin],
  esbuildOptions(options: { alias?: Record<string, string>; mainFields?: string[]; conditions?: string[] }) {
    options.alias = { "@schemas": schemasDir };
    // Use CJS ("main") first to avoid ESM-only exports in packages that ship both CJS and ESM.
    // "import" is added to handle @galaxy-tool-util/* which only expose an "import" export condition.
    options.mainFields = ["main", "module"];
    options.conditions = ["require", "import", "node", "default"];
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
