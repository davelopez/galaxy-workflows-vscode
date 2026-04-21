import "reflect-metadata";
import { extractStepSummariesFromDocument } from "@gxwf/server-common/src/services/toolCacheService";
import { createNativeWorkflowDocument } from "../testHelpers";

describe("extractStepSummariesFromDocument — native (.ga) dict steps", () => {
  it("reads tool_id/version/label for each step and supplies a range", () => {
    const json = JSON.stringify(
      {
        a_galaxy_workflow: "true",
        steps: {
          "0": {
            id: 0,
            type: "tool",
            tool_id: "toolshed.g2.bx.psu.edu/repos/iuc/bowtie2/bowtie2/2.4.4",
            tool_version: "2.4.4",
            annotation: "First annotation",
          },
          "1": { id: 1, type: "tool", tool_id: "second", tool_version: "2.0", label: "Second" },
        },
      },
      null,
      2
    );
    const doc = createNativeWorkflowDocument(json);
    const summaries = extractStepSummariesFromDocument(doc);
    expect(summaries).toHaveLength(2);
    const byId = Object.fromEntries(summaries.map((s) => [s.stepId, s]));
    expect(byId["0"].toolId).toContain("bowtie2");
    expect(byId["0"].label).toBe("First annotation");
    expect(byId["0"].toolIdRange).toBeDefined();
    expect(byId["1"].toolId).toBe("second");
    expect(byId["1"].toolVersion).toBe("2.0");
    expect(byId["1"].label).toBe("Second");
  });

  it("skips the tool_id-less step but still lists it in output", () => {
    const json = JSON.stringify({
      a_galaxy_workflow: "true",
      steps: { "0": { id: 0, type: "data_input" } },
    });
    const doc = createNativeWorkflowDocument(json);
    const summaries = extractStepSummariesFromDocument(doc);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].toolId).toBeUndefined();
  });
});
