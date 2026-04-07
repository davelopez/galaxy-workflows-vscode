// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

/* eslint-disable @typescript-eslint/no-var-requires */
const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("./tsconfig.json");

module.exports = {
  preset: "ts-jest",
  // The glob patterns Jest uses to detect test files
  testMatch: ["**/__tests__/*.+(ts|tsx|js)", "**/*.test.ts"],
  // Server tests are handled by Vitest (server/vitest.config.ts)
  testPathIgnorePatterns: ["/node_modules/", "/server/"],

  // An array of file extensions your modules use
  moduleFileExtensions: ["ts", "tsx", "js", "yaml"],
  transform: {
    // ... other transforms ...
    "\\.yaml$": "jest-transform-yaml",
    "^.+.tsx?$": [
      "ts-jest",
      {
        tsconfig: { ...compilerOptions, module: "commonjs", moduleResolution: "node" },
      },
    ],
  },
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: "<rootDir>/" }),
};
