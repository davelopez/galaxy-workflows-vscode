import { parse as parseYAML, YAMLDocument } from "../../src/parser";
import { ArrayASTNode, ObjectASTNode, PropertyASTNode } from "../../src/parser/astTypes";
import { expectPropertyToHaveKeyValue, toTextDocument } from "../testHelper";

const parse = (contents: string): YAMLDocument => {
  return parseYAML(toTextDocument(contents));
};

describe("YAML parser", () => {
  it("creates an empty sub-document on empty text", () => {
    const parsedDocument = parse("");
    expect(parsedDocument.subDocuments.length).toBe(1);
  });

  it("creates a sub-document when only comment", () => {
    const parsedDocument = parse("# a comment");
    expect(parsedDocument.subDocuments.length).toBe(1);
  });

  it("creates a single sub-document with --- at the start of the file", () => {
    const parsedDocument = parse("---\n# a comment\ntest: test");
    expect(parsedDocument.subDocuments.length).toBe(1);
    expect(parsedDocument.subDocuments[0].lineComments.length).toBe(1);
    expect(parsedDocument.subDocuments[0].lineComments[0].text).toBe("# a comment");
  });

  it("creates a multi document with --- at the start of the file", () => {
    const parsedDocument = parse("---\n# a comment\ntest: test\n...\n---\n# second document\ntest2: test2");
    expect(parsedDocument.subDocuments.length).toBe(2);
    expect(parsedDocument.subDocuments[0].lineComments.length).toBe(1);
    expect(parsedDocument.subDocuments[0].lineComments[0].text).toBe("# a comment");

    expect(parsedDocument.subDocuments[1].lineComments.length).toBe(1);
    expect(parsedDocument.subDocuments[1].lineComments[0].text).toBe("# second document");
  });

  it("creates a single sub-document with directives and line comments", () => {
    const parsedDocument = parse("%TAG !yaml! tag:yaml.org,2002:\n---\n# a comment\ntest");
    expect(parsedDocument.subDocuments.length).toBe(1);
    expect(parsedDocument.subDocuments[0]?.root?.children?.length).toBe(0);
    expect(parsedDocument.subDocuments[0].lineComments.length).toBe(1);
    expect(parsedDocument.subDocuments[0].lineComments[0].text).toBe("# a comment");
  });

  it("creates 2 sub-documents with directives and line comments", () => {
    const parsedDocument = parse("%TAG !yaml! tag:yaml.org,2002:\n# a comment\ntest\n...\n---\ntest2");
    expect(parsedDocument.subDocuments.length).toBe(2);
    expect(parsedDocument.subDocuments[0]?.root?.children?.length).toBe(0);
    expect(parsedDocument.subDocuments[1]?.root?.children?.length).toBe(0);
    expect(parsedDocument.subDocuments[1]?.root?.value).toBe("test2");
    expect(parsedDocument.subDocuments[0].lineComments.length).toBe(1);
    expect(parsedDocument.subDocuments[0].lineComments[0].text).toBe("# a comment");
  });

  it("creates a single sub-document", () => {
    const parsedDocument = parse("test");
    expect(parsedDocument.subDocuments.length).toBe(1);
    expect(parsedDocument.subDocuments[0]?.root?.value).toBe("test");
    expect(parsedDocument.subDocuments[0]?.root?.children?.length).toBe(0);
  });

  it("creates a single document with directives", () => {
    const parsedDocument = parse("%TAG !yaml! tag:yaml.org,2002:\n---\ntest");
    expect(parsedDocument.subDocuments.length).toBe(1);
    expect(parsedDocument.subDocuments[0]?.root?.value).toBe("test");
    expect(parsedDocument.subDocuments[0]?.root?.children?.length).toBe(0);
  });

  it("creates 2 sub-documents", () => {
    const parsedDocument = parse("test\n---\ntest2");
    expect(parsedDocument.subDocuments.length).toBe(2);
    expect(parsedDocument.subDocuments[0]?.root?.value).toBe("test");
    expect(parsedDocument.subDocuments[0]?.root?.children?.length).toBe(0);
    expect(parsedDocument.subDocuments[1]?.root?.value).toBe("test2");
    expect(parsedDocument.subDocuments[1]?.root?.children?.length).toBe(0);
  });

  it("creates 3 sub-documents", () => {
    const parsedDocument = parse("test\n---\ntest2\n---\ntest3");
    expect(parsedDocument.subDocuments.length).toBe(3);
    expect(parsedDocument.subDocuments[0]?.root?.value).toBe("test");
    expect(parsedDocument.subDocuments[0]?.root?.children?.length).toBe(0);
    expect(parsedDocument.subDocuments[1]?.root?.value).toBe("test2");
    expect(parsedDocument.subDocuments[1]?.root?.children?.length).toBe(0);
    expect(parsedDocument.subDocuments[2]?.root?.value).toBe("test3");
    expect(parsedDocument.subDocuments[2]?.root?.children?.length).toBe(0);
  });

  it("creates a single document with comment", () => {
    const parsedDocument = parse("# a comment\ntest");
    expect(parsedDocument.subDocuments.length).toBe(1);
    expect(parsedDocument.subDocuments[0]?.root?.value).toBe("test");
    expect(parsedDocument.subDocuments[0].lineComments.length).toBe(1);
    expect(parsedDocument.subDocuments[0].lineComments[0].text).toBe("# a comment");
  });

  it("creates 2 sub-documents with comment", () => {
    const parsedDocument = parse("---\n# a comment\ntest: test\n---\n# a second comment\ntest2");
    expect(parsedDocument.subDocuments.length).toBe(2);
    expect(parsedDocument.subDocuments[0].root as ObjectASTNode).toBeDefined();
    const firstProperty = (parsedDocument.subDocuments[0].root as ObjectASTNode).properties[0] as PropertyASTNode;
    expect(firstProperty).toBeDefined();
    expectPropertyToHaveKeyValue(firstProperty, "test", "test");
    expect(parsedDocument.subDocuments[0].lineComments.length).toBe(1);
    expect(parsedDocument.subDocuments[0].lineComments[0].text).toBe("# a comment");

    expect(parsedDocument.subDocuments[1]?.root?.value).toBe("test2");
    expect(parsedDocument.subDocuments[1]?.root?.children?.length).toBe(0);
    expect(parsedDocument.subDocuments[1].lineComments.length).toBe(1);
    expect(parsedDocument.subDocuments[1].lineComments[0].text).toBe("# a second comment");
  });

  it('creates a document with "str" tag from recommended schema', () => {
    const parsedDocument = parse('"yes as a string with tag": !!str yes');
    expect(parsedDocument.subDocuments.length).toBe(1);
    expect(parsedDocument.subDocuments[0].errors.length).toBe(0);
  });

  it('creates a document with "int" tag from recommended schema', () => {
    const parsedDocument = parse("POSTGRES_PORT: !!int 54");
    expect(parsedDocument.subDocuments.length).toBe(1);
    expect(parsedDocument.subDocuments[0].errors.length).toBe(0);
  });
});

describe("YAML parser bugs", () => {
  it('should work with "Billion Laughs" attack', () => {
    const yaml = `apiVersion: v1
data:
a: &a ["web","web","web","web","web","web","web","web","web"]
b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]
c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]
d: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]
e: &e [*d,*d,*d,*d,*d,*d,*d,*d,*d]
f: &f [*e,*e,*e,*e,*e,*e,*e,*e,*e]
g: &g [*f,*f,*f,*f,*f,*f,*f,*f,*f]
h: &h [*g,*g,*g,*g,*g,*g,*g,*g,*g]
i: &i [*h,*h,*h,*h,*h,*h,*h,*h,*h]
kind: ConfigMap
metadata:
name: yaml-bomb
namespace: defaul`;
    const parsedDocument = parse(yaml);
    expect(parsedDocument.subDocuments.length).toBe(1);
  });

  it('should not add "undefined" as array item', () => {
    const yaml = `foo: 
- *`;
    const parsedDocument = parse(yaml);
    parsedDocument.subDocuments[0].root;
    expect(parsedDocument.subDocuments.length).toBe(1);
    expect(
      (
        ((parsedDocument.subDocuments[0].root as ObjectASTNode).properties[0] as PropertyASTNode)
          .valueNode as ArrayASTNode
      ).items[0]
    ).toBeDefined();
  });
});

describe("YamlDocument", () => {
  it("should identify comments", () => {
    const parsedDocument = parse("# a comment\ntest: test\n# a second comment");
    let isComment = parsedDocument.isComment(11);
    expect(isComment).toBe(true);
    isComment = parsedDocument.isComment(12);
    expect(isComment).toBe(false);
    isComment = parsedDocument.isComment(22);
    expect(isComment).toBe(false);
    isComment = parsedDocument.isComment(23);
    expect(isComment).toBe(true);
  });
  describe("getNodeFromOffset", () => {
    const SAMPLE_DOC = `
test: value
test02:
  prop03:
    test04: val
      
`;
    it.each([
      [0, "_root_"], // _root_ is not a property, is an object
      [1, "test"],
      [12, "test"],
      [13, "test02"],
      [20, "test02"],
      [22, "test02"],
      [23, "prop03"],
      [30, "prop03"],
      [31, "_root_"],
      [35, "test04"],
      [46, "test04"],
      [47, "_root_"],
      [49, "test02"],
      [51, "prop03"],
      [53, "test04"],
    ])("should return for offset %p the expected node name %p", (offset: number, expectedNodeName: string) => {
      const parsedDocument = parse(SAMPLE_DOC);
      const node = parsedDocument.getNodeFromOffset(offset);
      expect(node).toBeDefined();
      if (expectedNodeName === "_root_") {
        expect(node?.parent).toBeUndefined();
      } else {
        expect(node?.parent).toBeDefined();
      }
      if (node?.type === "property") {
        expect(node.keyNode.value).toBe(expectedNodeName);
      }
    });
  });
});
