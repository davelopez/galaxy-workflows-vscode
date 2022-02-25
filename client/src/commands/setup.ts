import { ExtensionContext } from "vscode";
import { CommonLanguageClient } from "vscode-languageclient";
import { CompareCleanWithWorkflowsCommand } from "./compareCleanWith";
import { CompareCleanWorkflowsCommand } from "./compareCleanWorkflows";
import { PreviewCleanWorkflowCommand } from "./previewCleanWorkflow";

/**
 * Registers all custom commands declared in package.json
 * @param context The extension context
 * @param client The language client
 */
export function setupCommands(context: ExtensionContext, client: CommonLanguageClient) {
  context.subscriptions.push(new PreviewCleanWorkflowCommand(client).register());
  context.subscriptions.push(new CompareCleanWorkflowsCommand(client).register());
  context.subscriptions.push(new CompareCleanWithWorkflowsCommand(client).register());
}
