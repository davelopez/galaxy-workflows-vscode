import { ASTNode, PropertyASTNode } from "vscode-json-languageservice";
import { getPathSegments, getPropertyNodeFromPath } from "../../../src/nativeServer/jsonUtils";
import { getJsonDocumentRoot } from "../testHelpers";

describe("JSON Utility Functions", () => {
  describe("getPathSegments", () => {
    it.each([
      ["", []],
      ["/", [""]],
      ["a", ["a"]],
      ["/a", ["a"]],
      ["a/b", ["a", "b"]],
      ["a/", ["a", ""]],
      [".", [""]],
      [".a", ["a"]],
      ["a.b", ["a", "b"]],
      ["a.", ["a", ""]],
    ])("returns the expected segments", (path: string, expected: string[]) => {
      const segments = getPathSegments(path);

      expect(segments).toHaveLength(expected.length);
      expect(segments).toEqual(expected);
    });
  });

  describe("getPropertyNodeFromPath", () => {
    describe("with valid path", () => {
      it.each([
        ['{"key":[{"key2":0}]}', "key"],
        ['{"key":[{"key2":0}]}', "key/0/key2"],
        ['{"key":[{"key2":0}],"key3":"val"}', "key3"],
        ['{"key":[{"key2":0},{"key3":"val"}]}', "key/1/key3"],
        ['{"key":{"key2":{"key3":"val"}}}', "key/key2"],
        ['{"key":{"key2":{"key3":"val"}}}', "key/key2/key3"],
      ])("returns the expected property node at the given path", (contents: string, path: string) => {
        const root = getJsonDocumentRoot(contents);
        const pathItems = path.split("/");
        const expectedPropertyKey = pathItems[pathItems.length - 1] as string;

        const propertyNode = getPropertyNodeFromPath(root, path);

        expectPropertyNodeToHaveKey(propertyNode, expectedPropertyKey);
      });
    });

    describe("with invalid path", () => {
      it.each([
        ['{"key":[{"key2":0}]}', "key2"],
        ['{"key":[{"key2":0}]}', "key3"],
        ['{"key":[{"key2":0}]}', "key/5"],
        ['{"key":{"key2":{"key3":"val"}}}', "key/key3"],
      ])("returns null", (contents: string, path: string) => {
        const root = getJsonDocumentRoot(contents);

        const propertyNode = getPropertyNodeFromPath(root, path);

        expect(propertyNode).toBeNull();
      });
    });
  });
});

function expectPropertyNodeToHaveKey(propertyNode: ASTNode | null, expectedPropertyKey: string): void {
  expect(propertyNode?.type).toBe("property");
  expect((propertyNode as PropertyASTNode).keyNode.value).toBe(expectedPropertyKey);
}
