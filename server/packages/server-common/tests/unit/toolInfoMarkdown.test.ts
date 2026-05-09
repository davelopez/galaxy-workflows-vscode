import type { ParsedTool } from "@galaxy-tool-util/schema";
import { buildToolInfoMarkdown } from "../../src/providers/hover/toolInfoMarkdown";

function makeTool(overrides: Partial<ParsedTool> = {}): ParsedTool {
  return {
    id: "toolshed.g2.bx.psu.edu/repos/devteam/bowtie2/bowtie2/2.4.4",
    version: "2.4.4",
    name: "Bowtie2",
    description: "Map reads to a reference genome.",
    inputs: [],
    outputs: [],
    citations: [],
    license: "MIT",
    profile: null,
    edam_operations: ["operation_0292"],
    edam_topics: ["topic_0102"],
    xrefs: [{ type: "bio.tools", value: "bowtie2" }],
    help: { format: "markdown", content: "Lots of help text." },
    ...overrides,
  };
}

describe("buildToolInfoMarkdown", () => {
  it("renders header with id@version and description blockquote", () => {
    const md = buildToolInfoMarkdown(makeTool());
    expect(md).toContain("**Bowtie2**");
    expect(md).toContain("@2.4.4");
    expect(md).toContain("> Map reads to a reference genome.");
  });

  it("includes license, edam ops/topics, xrefs, citations count, toolshed link, help", () => {
    const md = buildToolInfoMarkdown(
      makeTool({
        citations: [
          { type: "doi", content: "10.1/x" },
          { type: "doi", content: "10.1/y" },
        ],
      })
    );
    expect(md).toContain("License: MIT");
    expect(md).toContain("operation_0292");
    expect(md).toContain("topic_0102");
    expect(md).toContain("[bio.tools:bowtie2](https://bio.tools/bowtie2)");
    expect(md).toContain("Citations: 2");
    expect(md).toContain("(https://toolshed.g2.bx.psu.edu/view/devteam/bowtie2)");
    expect(md).toContain("Lots of help text.");
  });

  it("drops header version marker when version is null", () => {
    const md = buildToolInfoMarkdown(makeTool({ version: null }));
    expect(md).not.toContain("@");
    expect(md).toContain("**Bowtie2**");
  });

  it("handles minimal tool (null description/license/help)", () => {
    const md = buildToolInfoMarkdown(
      makeTool({
        description: null,
        license: null,
        edam_operations: [],
        edam_topics: [],
        xrefs: [],
        citations: [],
        help: null as unknown as ParsedTool["help"],
      })
    );
    expect(md).not.toContain("License:");
    expect(md).not.toContain("EDAM");
    expect(md).not.toContain(">");
    expect(md).not.toContain("---");
  });

  it("truncates help to helpExcerptChars", () => {
    const md = buildToolInfoMarkdown(makeTool({ help: { format: "markdown", content: "x".repeat(600) } }), {
      helpExcerptChars: 100,
    });
    expect(md).toContain("x".repeat(100) + "…");
    expect(md).not.toContain("x".repeat(101));
  });

  it("skips toolshed link for short/built-in tool ids", () => {
    const md = buildToolInfoMarkdown(makeTool({ id: "Cut1" }));
    expect(md).not.toContain("/view/");
  });
});
