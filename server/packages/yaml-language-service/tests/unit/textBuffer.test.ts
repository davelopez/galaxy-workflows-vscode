import { parseTemplate } from "@gxwf/server-common/tests/testHelpers";
import { TextBuffer } from "../../src/utils/textBuffer";
import { toTextDocument } from "../testHelper";

describe("TextBuffer", () => {
  function createTextBuffer(contents: string): TextBuffer {
    return new TextBuffer(toTextDocument(contents));
  }

  describe("getLineCount", () => {
    it("should return the number of lines in the document", () => {
      const contents = `line 1
line 2
line 3`;
      const textBuffer = createTextBuffer(contents);

      expect(textBuffer.getLineCount()).toBe(3);
    });
  });

  describe("getLineLength", () => {
    it("should return the length of the line", () => {
      const contents = `line 1
line 2
line 3`;
      const textBuffer = createTextBuffer(contents);

      // +1 for the newline character
      expect(textBuffer.getLineLength(0)).toBe(7);
      expect(textBuffer.getLineLength(1)).toBe(7);
      expect(textBuffer.getLineLength(2)).toBe(6);
    });
  });

  describe("getLineContent", () => {
    it("should return the content of the line", () => {
      const contents = `line 1
line 2
line 3`;
      const textBuffer = createTextBuffer(contents);

      expect(textBuffer.getLineContent(0)).toBe("line 1\n");
      expect(textBuffer.getLineContent(1)).toBe("line 2\n");
      expect(textBuffer.getLineContent(2)).toBe("line 3");
    });
  });

  describe("isPositionAfterToken", () => {
    const TOKEN = ":";
    it.each([
      ["$test:", false],
      ["te$st:", false],
      ["test$:", false],
      ["test:$", true],
      ["test: $", true],
      ["test:  $", true],
      ["test: $ ", true],
      ["test: $test", true],
    ])("returns expected result", (template: string, result: boolean) => {
      const { contents, position } = parseTemplate(template);
      const textBuffer = createTextBuffer(contents);
      expect(textBuffer.isPositionAfterToken(position, TOKEN)).toBe(result);
    });
  });
});
