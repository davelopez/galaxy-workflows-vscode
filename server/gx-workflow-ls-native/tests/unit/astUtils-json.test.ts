import { getPropertyNodeFromPath } from "@gxwf/server-common/src/ast/utils";
import { getJsonDocumentRoot } from "../testHelpers";
import { expectPropertyNodeToHaveKey } from "@gxwf/server-common/tests/testHelpers";

describe("AST Utility Functions with JSON", () => {
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
