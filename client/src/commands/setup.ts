import { ExtensionContext } from "vscode";
import { CommonLanguageClient } from "vscode-languageclient";
import { CompareCleanWithWorkflowsCommand } from "./compareCleanWith";
import { SelectForCleanCompareCommand } from "./selectForCleanCompare";
import { PreviewCleanWorkflowCommand } from "./previewCleanWorkflow";
import { CleanWorkflowProvider } from "../providers/cleanWorkflowProvider";
import { GitProvider } from "../providers/git/common";
import { CleanWorkflowCommand } from "./cleanWorkflow";

/**
 * Registers all custom commands declared in package.json
 * @param context The extension context
 * @param client The language client
 */
export function setupCommands(context: ExtensionContext, client: CommonLanguageClient, gitProvider: GitProvider) {
  context.subscriptions.push(new PreviewCleanWorkflowCommand(client).register());
  context.subscriptions.push(new CleanWorkflowCommand(client).register());
  const selectForCompareProvider = new SelectForCleanCompareCommand(client);
  context.subscriptions.push(selectForCompareProvider.register());
  context.subscriptions.push(
    new CompareCleanWithWorkflowsCommand(
      client,
      selectForCompareProvider,
      new CleanWorkflowProvider(client, gitProvider)
    ).register()
  );
}
