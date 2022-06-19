// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  preset: "ts-jest",
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
  // The glob patterns Jest uses to detect test files
  testMatch: ["**/__tests__/*.+(ts|tsx|js)", "**/unit/*.test.ts"],

  // An array of file extensions your modules use
  moduleFileExtensions: ["ts", "tsx", "js"],
};
