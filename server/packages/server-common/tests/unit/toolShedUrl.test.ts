import { parseToolShedRepoUrl } from "../../src/providers/hover/toolShedUrl";

describe("parseToolShedRepoUrl", () => {
  it("parses a toolshed id into a view url", () => {
    expect(parseToolShedRepoUrl("toolshed.g2.bx.psu.edu/repos/devteam/bowtie2/bowtie2/2.4.4")).toBe(
      "https://toolshed.g2.bx.psu.edu/view/devteam/bowtie2"
    );
  });

  it("returns null for short/built-in ids", () => {
    expect(parseToolShedRepoUrl("Cut1")).toBeNull();
    expect(parseToolShedRepoUrl("cat1")).toBeNull();
  });

  it("returns null for malformed ids (missing repos segment)", () => {
    expect(parseToolShedRepoUrl("toolshed.g2.bx.psu.edu/devteam/bowtie2/bowtie2/2.4.4")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseToolShedRepoUrl("")).toBeNull();
  });
});
