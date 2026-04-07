import path from "path";
import yaml from "@modyfi/vite-plugin-yaml";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/__tests__/*.+(ts|tsx|js)", "**/*.test.ts"],
    exclude: ["**/node_modules/**"],
  },
  // Disable Oxc (vitest 4.x default) since unplugin-swc handles transformation
  // with decorator metadata support required by inversify.
  oxc: false,
  plugins: [
    yaml(),
    swc.vite({
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { decoratorMetadata: true },
        target: "es2019",
      },
    }),
  ],
  resolve: {
    alias: {
      "@schemas": path.resolve(__dirname, "../workflow-languages/schemas"),
    },
  },
});
