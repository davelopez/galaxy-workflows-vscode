import { inject, injectable } from "inversify";
import { Connection } from "vscode-languageserver";
import {
  DocumentsCache,
  GetWorkflowInputsResult,
  GetWorkflowOutputsResult,
  LSRequestIdentifiers,
  TYPES,
  TargetWorkflowDocumentParams,
  WorkflowDataProvider,
  WorkflowDocument,
} from "../languageTypes";

@injectable()
export class WorkflowDataProviderImpl implements WorkflowDataProvider {
  constructor(
    @inject(TYPES.Connection) public readonly connection: Connection,
    @inject(TYPES.DocumentsCache) public readonly documentsCache: DocumentsCache
  ) {
    // Register the request handler for getting workflow inputs
    connection.onRequest(LSRequestIdentifiers.GET_WORKFLOW_INPUTS, (params: TargetWorkflowDocumentParams) => {
      // if we receive a request to get workflow inputs, we can expect that the workflow document is in the cache
      // because the client should have opened it before sending the request.
      const workflowDocument = this.getWorkflowDocument(params.uri);
      return workflowDocument ? workflowDocument.getWorkflowInputs() : { inputs: [] };
    });

    // Register the request handler for getting workflow outputs
    connection.onRequest(LSRequestIdentifiers.GET_WORKFLOW_OUTPUTS, (params: TargetWorkflowDocumentParams) => {
      // if we receive a request to get workflow outputs, we can expect that the workflow document is in the cache
      // because the client should have opened it before sending the request.
      const workflowDocument = this.getWorkflowDocument(params.uri);
      return workflowDocument ? workflowDocument.getWorkflowOutputs() : { outputs: [] };
    });
  }

  /**
   * Returns the inputs of the associated workflow given the URI of the workflow document or the associated test document.
   * @param workflowDocumentUri The URI of the workflow document or the associated test document.
   * @returns The inputs of the associated workflow.
   */
  public async getWorkflowInputs(workflowDocumentUri: string): Promise<GetWorkflowInputsResult> {
    const params: TargetWorkflowDocumentParams = {
      uri: workflowDocumentUri.toString(),
    };
    // The URI could be of the associated test document. Since we don't know which kind of workflow document
    // it is (.ga or format2), we need to ask the client to get the workflow inputs.
    // The client will then delegate the request to the appropriate language server after making sure
    // that the workflow document is in the cache by opening it.
    return this.connection.sendRequest<GetWorkflowInputsResult>(LSRequestIdentifiers.GET_WORKFLOW_INPUTS, params);
  }

  /**
   * Returns the outputs of the associated workflow given the URI of the workflow document or the associated test document.
   * @param workflowDocumentUri The URI of the workflow document or the associated test document.
   * @returns The outputs of the associated workflow.
   */
  public async getWorkflowOutputs(workflowDocumentUri: string): Promise<GetWorkflowOutputsResult> {
    const params: TargetWorkflowDocumentParams = {
      uri: workflowDocumentUri.toString(),
    };
    // The URI could be of the associated test document. Since we don't know which kind of workflow document
    // it is (.ga or format2), we need to ask the client to get the workflow outputs.
    // The client will then delegate the request to the appropriate language server after making sure
    // that the workflow document is in the cache by opening it.
    return this.connection.sendRequest<GetWorkflowOutputsResult>(LSRequestIdentifiers.GET_WORKFLOW_OUTPUTS, params);
  }

  private getWorkflowDocument(uri: string): WorkflowDocument | undefined {
    return this.documentsCache.get(uri) as WorkflowDocument;
  }
}
