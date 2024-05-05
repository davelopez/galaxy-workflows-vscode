import { ExtensionContext, Uri, workspace } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import {
  GetWorkflowInputsResult,
  GetWorkflowOutputsResult,
  LSRequestIdentifiers,
  TargetWorkflowDocumentParams,
} from "../common/requestsDefinitions";
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
  function createRequestHandler<TResult>(requestIdentifier: string) {
    return async (params: TargetWorkflowDocumentParams) => {
      let targetUri: Uri | undefined = Uri.parse(params.uri);
      if (isWorkflowTestsDocument(targetUri)) {
        // If the target is a test file, we need to find the associated workflow file
        targetUri = await getAssociatedWorkflowUriFromTestsUri(targetUri);
      }
      if (!targetUri) {
        console.debug("No associated workflow file found for:", params.uri);
        return undefined;
      }
      // Open the file to include it in the document cache
      await workspace.openTextDocument(targetUri);

      let languageClient = gxFormat2Client;
      if (isNativeWorkflowDocument(targetUri)) {
        languageClient = nativeWorkflowClient;
      }
      const requestParams: TargetWorkflowDocumentParams = { uri: targetUri.toString() };
      const result = await languageClient.sendRequest<TResult>(requestIdentifier, requestParams);
      return result;
    };
  }

  context.subscriptions.push(
    gxFormat2Client.onRequest(
      LSRequestIdentifiers.GET_WORKFLOW_INPUTS,
      createRequestHandler<GetWorkflowInputsResult>(LSRequestIdentifiers.GET_WORKFLOW_INPUTS)
    )
  );

  context.subscriptions.push(
    gxFormat2Client.onRequest(
      LSRequestIdentifiers.GET_WORKFLOW_OUTPUTS,
      createRequestHandler<GetWorkflowOutputsResult>(LSRequestIdentifiers.GET_WORKFLOW_OUTPUTS)
    )
  );
}
