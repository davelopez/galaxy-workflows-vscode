import * as fs from "fs";
import * as path from "path";

const TEST_DATA_PATH = path.join(__dirname, "..", "..", "test-data");

interface TestJsonWorkflows {
  /** Workflows for testing validation issues. */
  validation: {
    /** Invalid workflow without steps. */
    withoutSteps: string;
    /** Valid workflow with 1 step. */
    withOneStep: string;
    /** Invalid workflow with 3 steps. The steps are missing UUID and workflow_outputs. */
    withThreeSteps: string;
  };
}

export class TestWorkflowProvider {
  private static _jsonWorkflows: TestJsonWorkflows = {
    validation: {
      withoutSteps: fs.readFileSync(path.join(TEST_DATA_PATH, "json", "validation", "test_wf_00.ga"), "utf-8"),
      withOneStep: fs.readFileSync(path.join(TEST_DATA_PATH, "json", "validation", "test_wf_01.ga"), "utf-8"),
      withThreeSteps: fs.readFileSync(path.join(TEST_DATA_PATH, "json", "validation", "test_wf_02.ga"), "utf-8"),
    },
  };

  /** Workflows in native JSON format. */
  public static get nativeJson(): TestJsonWorkflows {
    return this._jsonWorkflows;
  }
}
