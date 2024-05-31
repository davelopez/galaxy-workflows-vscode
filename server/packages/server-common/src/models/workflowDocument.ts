import { GetWorkflowInputsResult, GetWorkflowOutputsResult } from "../languageTypes";
import { DocumentBase } from "./document";

/**
 * This class abstracts the common logic of workflow documents.
 */
export abstract class WorkflowDocument extends DocumentBase {
  /**
   * Returns the inputs of the workflow.
   */
  public abstract getWorkflowInputs(): GetWorkflowInputsResult;

  /**
   * Returns the outputs of the workflow.
   */
  public abstract getWorkflowOutputs(): GetWorkflowOutputsResult;
}
