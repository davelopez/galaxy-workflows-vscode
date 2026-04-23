import { insertFormat2Step, insertNativeStep } from "../../src/commands/insertToolStepHelpers";

describe("insertNativeStep", () => {
  it("assigns the next numeric key and rewrites step.id", () => {
    const original = JSON.stringify(
      {
        name: "wf",
        steps: {
          "0": { id: 0, type: "data_input" },
          "1": { id: 1, type: "tool" },
        },
      },
      null,
      4
    );
    const step = { id: 0, type: "tool", tool_id: "t1" };
    const result = insertNativeStep(original, step);
    const parsed = JSON.parse(result) as { steps: Record<string, { id: number; tool_id?: string }> };
    expect(Object.keys(parsed.steps)).toContain("2");
    expect(parsed.steps["2"].id).toBe(2);
    expect(parsed.steps["2"].tool_id).toBe("t1");
  });

  it("creates the steps object when missing", () => {
    const original = JSON.stringify({ name: "wf" });
    const result = insertNativeStep(original, { id: 0, tool_id: "t1" });
    const parsed = JSON.parse(result) as { steps: Record<string, { id: number }> };
    expect(parsed.steps["0"].id).toBe(0);
  });
});

describe("insertFormat2Step", () => {
  it("appends the step when steps is a sequence", () => {
    const original = [
      "class: GalaxyWorkflow",
      "steps:",
      "  - label: first",
      "    tool_id: t0",
      "",
    ].join("\n");
    const result = insertFormat2Step(original, { label: "second", tool_id: "t1" });
    expect(result).toContain("tool_id: t0");
    expect(result).toContain("tool_id: t1");
    // New step comes after the first one.
    expect(result.indexOf("tool_id: t1")).toBeGreaterThan(result.indexOf("tool_id: t0"));
  });

  it("creates the steps sequence when missing", () => {
    const original = "class: GalaxyWorkflow\n";
    const result = insertFormat2Step(original, { label: "only", tool_id: "t1" });
    expect(result).toContain("steps:");
    expect(result).toContain("tool_id: t1");
  });
});
