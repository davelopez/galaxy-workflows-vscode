import "reflect-metadata";
import { extractStepSummariesFromDocument } from "@gxwf/server-common/src/services/toolCacheService";
import { createFormat2WorkflowDocument } from "../testHelpers";

describe("extractStepSummariesFromDocument — format2 (.gxwf.yml) dict steps", () => {
  it("reads tool_id/version/label and supplies a range", () => {
    const yaml = `class: GalaxyWorkflow
inputs: {}
outputs: {}
steps:
  step_a:
    label: Step A
    tool_id: toolshed.g2.bx.psu.edu/repos/iuc/bowtie2/bowtie2/2.4.4
    tool_version: "2.4.4"
  step_b:
    tool_id: Cut1
    tool_version: "1.0"
`;
    const doc = createFormat2WorkflowDocument(yaml);
    const summaries = extractStepSummariesFromDocument(doc);
    expect(summaries).toHaveLength(2);
    expect(summaries[0].stepId).toBe("step_a");
    expect(summaries[0].label).toBe("Step A");
    expect(summaries[0].toolId).toContain("bowtie2");
    expect(summaries[1].stepId).toBe("step_b");
    expect(summaries[1].toolId).toBe("Cut1");
    expect(summaries[0].toolIdRange).toBeDefined();
  });
});
