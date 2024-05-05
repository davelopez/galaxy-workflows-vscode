import { WorkflowDataProvider } from "../languageTypes";
import { WorkflowInput, WorkflowOutput } from "../services/requestsDefinitions";
import { DocumentBase } from "./document";

/**
 * This class contains information about a document containing workflow tests.
 */
export abstract class WorkflowTestsDocument extends DocumentBase {
  protected abstract readonly workflowDataProvider?: WorkflowDataProvider;

  /**
   * Returns the inputs of the associated workflow if available or an empty array otherwise.
   */
  public async getWorkflowInputs(): Promise<WorkflowInput[]> {
    const result = await this.workflowDataProvider?.getWorkflowInputs(this.textDocument.uri);
    return result?.inputs ?? [];
  }

  /**
   * Returns the outputs of the associated workflow if available or an empty array otherwise.
   */
  public async getWorkflowOutputs(): Promise<WorkflowOutput[]> {
    const result = await this.workflowDataProvider?.getWorkflowOutputs(this.textDocument.uri);
    return result?.outputs ?? [];
  }
}
