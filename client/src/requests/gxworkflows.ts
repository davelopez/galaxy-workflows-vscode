import { ExtensionContext, Uri, workspace } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import {
  getAssociatedWorkflowUriFromTestsUri,
  isNativeWorkflowDocument,
  isWorkflowTestsDocument,
} from "../common/utils";
import {
  GetWorkflowInputsResult,
  GetWorkflowOutputsResult,
  LSRequestIdentifiers,
  TargetWorkflowDocumentParams,
} from "../languageTypes";

const TEST_DOCUMENT_TO_WORKFLOW_DOCUMENT_URI_MAP = new Map<string, Uri>();

export function setupRequests(
  context: ExtensionContext,
  nativeWorkflowClient: BaseLanguageClient,
  gxFormat2Client: BaseLanguageClient
): void {
  function createRequestHandler<TResult>(requestIdentifier: string) {
    return async (params: TargetWorkflowDocumentParams) => {
      const targetUri: Uri | undefined = Uri.parse(params.uri);
      let resultUri: Uri | undefined = undefined;
      if (isWorkflowTestsDocument(targetUri)) {
        // If the target is a test file, we need to find the associated workflow file
        //Try cache first
        const cacheKey = targetUri.toString();
        if (TEST_DOCUMENT_TO_WORKFLOW_DOCUMENT_URI_MAP.has(cacheKey)) {
          resultUri = TEST_DOCUMENT_TO_WORKFLOW_DOCUMENT_URI_MAP.get(cacheKey)!;
        }
        if (!resultUri) {
          resultUri = await getAssociatedWorkflowUriFromTestsUri(targetUri);
          if (resultUri) {
            TEST_DOCUMENT_TO_WORKFLOW_DOCUMENT_URI_MAP.set(cacheKey, resultUri);
          }
        }
      }
      if (!resultUri) {
        console.debug("No associated workflow file found for:", params.uri);
        return undefined;
      }
      // Open the file to include it in the document cache
      await workspace.openTextDocument(resultUri);

      let languageClient = gxFormat2Client;
      if (isNativeWorkflowDocument(resultUri)) {
        languageClient = nativeWorkflowClient;
      }
      const requestParams: TargetWorkflowDocumentParams = { uri: resultUri.toString() };
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
