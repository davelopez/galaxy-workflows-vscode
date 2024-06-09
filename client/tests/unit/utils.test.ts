import { it } from "@jest/globals"; // This is a workaround for type clashes between jest and mocha
import { URI } from "vscode-uri";
import { isFormat2WorkflowDocument, isNativeWorkflowDocument, isWorkflowTestsDocument } from "../../src/common/utils";

jest.mock(
  "vscode",
  () => ({
    workspace: {
      // Mock properties and methods of `workspace` as needed for your tests
    },
    // Add other vscode namespaces and members you need to mock
  }),
  { virtual: true }
);

describe("Common Utils", () => {
  describe("isWorkflowTestsDocument", () => {
    it.each([
      ["-test.yml", true],
      ["-tests.yml", true],
      ["-test.yaml", true],
      ["-tests.yaml", true],
      ["test.txt", false],
      ["tests.txt", false],
      ["test.yml", false],
      ["tests.yml", false],
      ["whatever.test.yml", false],
      ["whatever.gxwf.test.yml", false],
      ["whatevertest.yml", false],
      ["whatever.gxwftest.yml", false],
    ])("given '%s' should return %s", (input: string, expected: boolean) => {
      expect(isWorkflowTestsDocument(URI.parse(input))).toBe(expected);
    });
  });

  describe("isNativeWorkflowDocument", () => {
    it.each([
      ["test.ga", true],
      ["whatever.ga", true],
      ["asd.txt", false],
      ["test.yaml", false],
    ])("given '%s' should return %s", (input: string, expected: boolean) => {
      expect(isNativeWorkflowDocument(URI.parse(input))).toBe(expected);
    });
  });

  describe("isFormat2WorkflowDocument", () => {
    it.each([
      ["test.gxwf.yaml", true],
      ["whatever.gxwf.yaml", true],
      ["test.gxwf.yml", true],
      ["whatever.gxwf.yml", true],
      ["asd.txt", false],
      ["-test.yaml", false],
      ["whatever-test.yaml", false],
      ["whatever.gxwf-test.yaml", false],
      ["whatever.gxwf.test.yaml", false],
    ])("given '%s' should return %s", (input: string, expected: boolean) => {
      expect(isFormat2WorkflowDocument(URI.parse(input))).toBe(expected);
    });
  });
});
