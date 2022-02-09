import { ExtensionContext } from "vscode";
import { LanguageClient } from "vscode-languageclient/browser";
import { CompareCleanWorkflowsCommand } from "./compareCleanWorkflows";
import { PreviewCleanWorkflowCommand } from "./previewCleanWorkflow";

/**
 * Registers all custom commands declared in package.json
 * @param context The extension context
 * @param client The language client
 */
export function setupCommands(context: ExtensionContext, client: LanguageClient) {
  context.subscriptions.push(new PreviewCleanWorkflowCommand(client).register());
  context.subscriptions.push(new CompareCleanWorkflowsCommand(client).register());
}
