import yaml from "@modyfi/vite-plugin-yaml";
import path from "path";
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
      "@gxwf/server-common/src": path.resolve(__dirname, "packages/server-common/src"),
      "@gxwf/server-common/tests": path.resolve(__dirname, "packages/server-common/tests"),
      "@gxwf/workflow-tests-language-service/src": path.resolve(
        __dirname,
        "packages/workflow-tests-language-service/src"
      ),
      "@gxwf/yaml-language-service/src": path.resolve(__dirname, "packages/yaml-language-service/src"),
    },
  },
});
