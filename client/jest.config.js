// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

/* eslint-disable @typescript-eslint/no-var-requires */
const { compilerOptions } = require("./tsconfig.json");

module.exports = {
  preset: "ts-jest",
  globals: {
    "ts-jest": {
      tsconfig: compilerOptions,
    },
  },
  // The glob patterns Jest uses to detect test files
  testMatch: ["**/__tests__/*.+(ts|tsx|js)", "**/*.test.ts"],

  // An array of file extensions your modules use
  moduleFileExtensions: ["ts", "tsx", "js"],
};
