import { ExtensionContext } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { CleanWorkflowProvider } from "../providers/cleanWorkflowProvider";
import { ConvertedWorkflowDocumentProvider } from "../providers/convertedWorkflowDocumentProvider";
import { GitProvider } from "../providers/git";
import { CleanWorkflowCommand } from "./cleanWorkflow";
import { CompareCleanWithWorkflowsCommand } from "./compareCleanWith";
import { ConvertToFormat2Command, ConvertToNativeCommand } from "./convertWorkflow";
import { PopulateToolCacheCommand } from "./populateToolCache";
import { PreviewCleanWorkflowCommand } from "./previewCleanWorkflow";
import { SelectForCleanCompareCommand } from "./selectForCleanCompare";

/**
 * Registers all custom commands declared in package.json
 * @param context The extension context
 * @param client The language client
 */
export function setupCommands(context: ExtensionContext, client: BaseLanguageClient, gitProvider: GitProvider): void {
  const convertedProvider = ConvertedWorkflowDocumentProvider.register(context);
  context.subscriptions.push(new ConvertToFormat2Command(client, convertedProvider).register());
  context.subscriptions.push(new ConvertToNativeCommand(client, convertedProvider).register());

  context.subscriptions.push(new PreviewCleanWorkflowCommand(client).register());
  context.subscriptions.push(new CleanWorkflowCommand(client).register());
  context.subscriptions.push(new PopulateToolCacheCommand(client).register());
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
