import * as fs from "fs";
import * as path from "path";

const TEST_DATA_PATH = path.join(__dirname, "..", "..", "..", "test-data");

interface TestJsonWorkflows {
  /** Workflows for testing validation issues. */
  validation: {
    /** Invalid workflow without steps. */
    withoutSteps: string;
    /** Valid workflow with 1 step. */
    withOneStep: string;
    /** Invalid workflow with 3 steps. The steps are missing UUID and workflow_outputs. */
    withThreeSteps: string;
    /** Workflow with 1 step. The step has 2 workflow_outputs without labels. */
    withoutWorkflowOutputLabels: string;
    /** Workflow with 1 step. The step has 2 workflow_outputs with labels. */
    withWorkflowOutputLabels: string;
    /** Workflow with 6 steps. All steps are inputs with different types. */
    withOnlyInputs: string;
  };
}

export class TestWorkflowProvider {
  private static _jsonWorkflows: TestJsonWorkflows = {
    validation: {
      withoutSteps: fs.readFileSync(path.join(TEST_DATA_PATH, "json", "validation", "test_wf_00.ga"), "utf-8"),
      withOneStep: fs.readFileSync(path.join(TEST_DATA_PATH, "json", "validation", "test_wf_01.ga"), "utf-8"),
      withThreeSteps: fs.readFileSync(path.join(TEST_DATA_PATH, "json", "validation", "test_wf_02.ga"), "utf-8"),
      withoutWorkflowOutputLabels: fs.readFileSync(
        path.join(TEST_DATA_PATH, "json", "validation", "test_wf_03.ga"),
        "utf-8"
      ),
      withWorkflowOutputLabels: fs.readFileSync(
        path.join(TEST_DATA_PATH, "json", "validation", "test_wf_04.ga"),
        "utf-8"
      ),
      withOnlyInputs: fs.readFileSync(path.join(TEST_DATA_PATH, "json", "validation", "test_wf_05.ga"), "utf-8"),
    },
  };

  /** Workflows in native JSON format. */
  public static get workflows(): TestJsonWorkflows {
    return this._jsonWorkflows;
  }
}
