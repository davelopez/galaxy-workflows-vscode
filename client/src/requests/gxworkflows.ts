import { ExtensionContext, Uri, workspace } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { GetWorkflowInputsParams, GetWorkflowInputsResult, LSRequestIdentifiers } from "../common/requestsDefinitions";
import {
  getAssociatedWorkflowUriFromTestsUri,
  isNativeWorkflowDocument,
  isWorkflowTestsDocument,
} from "../common/utils";

export function setupRequests(
  context: ExtensionContext,
  nativeWorkflowClient: BaseLanguageClient,
  gxFormat2Client: BaseLanguageClient
): void {
  context.subscriptions.push(
    gxFormat2Client.onRequest(LSRequestIdentifiers.GET_WORKFLOW_INPUTS, async (params: GetWorkflowInputsParams) => {
      let targetUri: Uri | undefined = Uri.parse(params.uri);
      if (isWorkflowTestsDocument(targetUri)) {
        // If the file is a test file, we need to find the associated workflow file
        targetUri = await getAssociatedWorkflowUriFromTestsUri(targetUri);
      }
      if (!targetUri) {
        console.debug("No associated workflow file found for:", params.uri);
        return { inputs: [] };
      }
      // Open the file to include it in the document cache
      await workspace.openTextDocument(targetUri);

      let languageClient = gxFormat2Client;
      if (isNativeWorkflowDocument(targetUri)) {
        languageClient = nativeWorkflowClient;
      }
      const requestParams: GetWorkflowInputsParams = { uri: targetUri.toString() };
      const result = await languageClient.sendRequest<GetWorkflowInputsResult>(
        LSRequestIdentifiers.GET_WORKFLOW_INPUTS,
        requestParams
      );
      return result;
    })
  );
  context.subscriptions.push(
    gxFormat2Client.onRequest(LSRequestIdentifiers.GET_WORKFLOW_OUTPUTS, async (params: GetWorkflowInputsParams) => {
      let targetUri: Uri | undefined = Uri.parse(params.uri);
      if (isWorkflowTestsDocument(targetUri)) {
        // If the file is a test file, we need to find the associated workflow file
        targetUri = await getAssociatedWorkflowUriFromTestsUri(targetUri);
      }
      if (!targetUri) {
        console.debug("No associated workflow file found for:", params.uri);
        return { inputs: [] };
      }
      // Open the file to include it in the document cache
      await workspace.openTextDocument(targetUri);

      let languageClient = gxFormat2Client;
      if (isNativeWorkflowDocument(targetUri)) {
        languageClient = nativeWorkflowClient;
      }
      const requestParams: GetWorkflowInputsParams = { uri: targetUri.toString() };
      const result = await languageClient.sendRequest<GetWorkflowInputsResult>(
        LSRequestIdentifiers.GET_WORKFLOW_OUTPUTS,
        requestParams
      );
      return result;
    })
  );
}
