import { getPropertyNodeFromPath } from "@gxwf/server-common/src/ast/utils";
import { getYamlDocumentRoot } from "../testHelpers";
import { expectPropertyNodeToHaveKey } from "@gxwf/server-common/tests/testHelpers";

describe("AST Utility Functions with YAML", () => {
  describe("getPropertyNodeFromPath", () => {
    describe("with valid path", () => {
      it.each([
        ["key:\n  key2: 0\n", "key"],
        ["key:\n  key2: 0\n", "key/key2"],
        ["key:\n  key2: 0\nkey3: val", "key3"],
        ["key:\n  key2: 0}\n  key3: val", "key/key3"],
        ["key:\n  key2:\n    key3: val", "key/key2"],
        ["key:\n  key2:\n    key3: val", "key/key2/key3"],
      ])("returns the expected property node at the given path", (contents: string, path: string) => {
        const root = getYamlDocumentRoot(contents);
        const pathItems = path.split("/");
        const expectedPropertyKey = pathItems[pathItems.length - 1] as string;

        const propertyNode = getPropertyNodeFromPath(root, path);

        expectPropertyNodeToHaveKey(propertyNode, expectedPropertyKey);
      });
    });

    describe("with invalid path", () => {
      it.each([
        ["key:\n  key2: 0\n", "key2"],
        ["key:\n  key2: 0\n", "key3"],
        ["key:\n  key2: 0\n", "key/5"],
        ["key:\n  key2:\n    key3: val", "key/key3"],
      ])("returns null", (contents: string, path: string) => {
        const root = getYamlDocumentRoot(contents);

        const propertyNode = getPropertyNodeFromPath(root, path);

        expect(propertyNode).toBeNull();
      });
    });
  });
});
