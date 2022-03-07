import { ExtensionContext } from "vscode";
import { CommonLanguageClient } from "vscode-languageclient";
import { CompareCleanWithWorkflowsCommand } from "./compareCleanWith";
import { SelectForCleanCompareCommand } from "./selectForCleanCompare";
import { PreviewCleanWorkflowCommand } from "./previewCleanWorkflow";
import { CleanWorkflowProvider } from "../providers/cleanWorkflowProvider";

/**
 * Registers all custom commands declared in package.json
 * @param context The extension context
 * @param client The language client
 */
export function setupCommands(context: ExtensionContext, client: CommonLanguageClient) {
  context.subscriptions.push(new PreviewCleanWorkflowCommand(client).register());
  const selectForCompareProvider = new SelectForCleanCompareCommand(client);
  context.subscriptions.push(selectForCompareProvider.register());
  context.subscriptions.push(
    new CompareCleanWithWorkflowsCommand(client, selectForCompareProvider, new CleanWorkflowProvider(client)).register()
  );
}
