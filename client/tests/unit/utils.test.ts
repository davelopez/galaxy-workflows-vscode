import { it } from "@jest/globals"; // This is a workaround for type clashes between jest and mocha
import { URI } from "vscode-uri";
import {
  getAssociatedWorkflowUriFromTestsUri,
  isFormat2WorkflowDocument,
  isNativeWorkflowDocument,
  isWorkflowTestsDocument,
} from "../../src/common/utils";

// Partially mimics vscode FileStat interface
interface FileStat {
  size: number;
}

const FILES_IN_WORKSPACE = ["workflow1.ga", "workflow2.gxwf.yaml", "workflow3.gxwf.yml"];

jest.mock(
  "vscode",
  () => ({
    workspace: {
      fs: {
        stat: (uri: URI) => {
          const file = FILES_IN_WORKSPACE.find((f) => URI.parse(f).path === uri.path);
          if (file) {
            return Promise.resolve<FileStat>({ size: file.length });
          }
          throw new Error(`File not found: ${uri.path}`);
        },
      },
    },
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

  describe("getAssociatedWorkflowUriFromTestsUri", () => {
    it("should return undefined if the input URI is not a workflow tests document", async () => {
      const uri = URI.parse("test.txt");
      const result = await getAssociatedWorkflowUriFromTestsUri(uri);
      expect(result).toBeUndefined();
    });

    it("should return the associated (.ga) workflow document URI if it exists in workspace", async () => {
      const uri = URI.parse("workflow1-test.yaml");
      const result = await getAssociatedWorkflowUriFromTestsUri(uri);
      expect(result?.path.endsWith("workflow1.ga")).toBe(true);
    });

    it("should return the associated (yaml) workflow document URI if it exists in workspace", async () => {
      const uri = URI.parse("workflow2-test.yaml");
      const result = await getAssociatedWorkflowUriFromTestsUri(uri);
      expect(result?.path.endsWith("workflow2.gxwf.yaml")).toBe(true);
    });

    it("should return the associated (yml) workflow document URI if it exists in workspace", async () => {
      const uri = URI.parse("workflow3-tests.yaml");
      const result = await getAssociatedWorkflowUriFromTestsUri(uri);
      expect(result?.path.endsWith("workflow3.gxwf.yml")).toBe(true);
    });

    it("should return undefined if the associated workflow document does not exist in workspace", async () => {
      const uri = URI.parse("nonexistent-test.yaml");
      const result = await getAssociatedWorkflowUriFromTestsUri(uri);
      expect(result).toBeUndefined();
    });
  });
});
