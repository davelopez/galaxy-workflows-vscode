import { getPathSegments } from "@gxwf/server-common/src/ast/utils";

describe("AST Utility Functions", () => {
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
});
