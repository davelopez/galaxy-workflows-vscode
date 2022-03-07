import { ExtensionContext } from "vscode";
import { CommonLanguageClient } from "vscode-languageclient";
import { CompareCleanWithWorkflowsCommand } from "./compareCleanWith";
import { SelectForCleanCompareCommand } from "./selectForCleanCompare";
import { CompareCleanWorkflowsCommand } from "./compareCleanWorkflows";
import { PreviewCleanWorkflowCommand } from "./previewCleanWorkflow";
import { CleanWorkflowDocumentProvider } from "../providers/cleanWorkflowDocumentProvider";

/**
 * Registers all custom commands declared in package.json
 * @param context The extension context
 * @param client The language client
 */
export function setupCommands(context: ExtensionContext, client: CommonLanguageClient) {
  context.subscriptions.push(new PreviewCleanWorkflowCommand(client).register());
  context.subscriptions.push(new CompareCleanWorkflowsCommand(client).register());
  const selectForCompareProvider = new SelectForCleanCompareCommand(client);
  context.subscriptions.push(selectForCompareProvider.register());
  context.subscriptions.push(
    new CompareCleanWithWorkflowsCommand(
      client,
      selectForCompareProvider,
      new CleanWorkflowDocumentProvider(client)
    ).register()
  );
}
