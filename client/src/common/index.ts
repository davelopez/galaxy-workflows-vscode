import { commands, ExtensionContext, window, workspace } from "vscode";
import { BaseLanguageClient, DocumentSelector, LanguageClientOptions } from "vscode-languageclient";
import { setupCommands } from "../commands/setup";
import { CleanWorkflowDocumentProvider } from "../providers/cleanWorkflowDocumentProvider";
import { CleanWorkflowProvider } from "../providers/cleanWorkflowProvider";
import { GitProvider } from "../providers/git";
import { BuiltinGitProvider } from "../providers/git/gitProvider";
import {
  openEntryInToolShed,
  revealEntryInEditor,
  WorkflowToolsTreeProvider,
} from "../providers/workflowToolsTreeProvider";
import { setupRequests } from "../requests/gxworkflows";
import { ToolCacheStatusBar } from "../statusBar";
import { LSNotificationIdentifiers, ToolResolutionFailedParams, WorkflowToolEntry } from "../languageTypes";

export function buildBasicLanguageClientOptions(
  documentSelector: DocumentSelector,
  initializationOptions: Record<string, unknown> = {}
): LanguageClientOptions {
  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {},
    initializationOptions,
  };
  return clientOptions;
}

export function initExtension(
  context: ExtensionContext,
  nativeClient: BaseLanguageClient,
  gxFormat2Client: BaseLanguageClient
): void {
  const gitProvider = initGitProvider(context);

  // Setup native workflow language features
  setupProviders(context, nativeClient, gitProvider);
  setupCommands(context, nativeClient, gxFormat2Client, gitProvider);
  startLanguageClient(context, nativeClient);

  // Setup gxformat2 language features
  startLanguageClient(context, gxFormat2Client);

  setupRequests(context, nativeClient, gxFormat2Client);

  // Tool resolution failure notifications from the gxformat2 server
  const toolResolutionOutputChannel = window.createOutputChannel("Galaxy Workflows — Tool Resolution");
  context.subscriptions.push(toolResolutionOutputChannel);
  // The warning toast is shown once per session to avoid repeated interruptions
  // if many documents open at startup. All failures are still logged to the
  // output channel regardless.
  let shownResolutionWarning = false;
  context.subscriptions.push(
    gxFormat2Client.onNotification(
      LSNotificationIdentifiers.TOOL_RESOLUTION_FAILED,
      (params: ToolResolutionFailedParams) => {
        for (const { toolId, error } of params.failures) {
          toolResolutionOutputChannel.appendLine(`Could not resolve tool '${toolId}': ${error}`);
        }
        if (!shownResolutionWarning) {
          shownResolutionWarning = true;
          window
            .showWarningMessage(
              `Could not resolve ${params.failures.length} tool(s) from ToolShed. See Output for details.`,
              "Show Output"
            )
            .then((choice) => {
              if (choice === "Show Output") toolResolutionOutputChannel.show();
            });
        }
      }
    )
  );

  // Tool cache status bar
  const toolCacheStatusBar = new ToolCacheStatusBar(nativeClient);
  toolCacheStatusBar.startPolling();
  context.subscriptions.push(toolCacheStatusBar);

  // Workflow Tools tree view
  setupWorkflowToolsView(context, nativeClient, gxFormat2Client);
}

function setupWorkflowToolsView(
  context: ExtensionContext,
  nativeClient: BaseLanguageClient,
  format2Client: BaseLanguageClient
): void {
  const provider = new WorkflowToolsTreeProvider(nativeClient, format2Client);
  const view = window.createTreeView("galaxyWorkflows.toolsView", {
    treeDataProvider: provider,
  });
  context.subscriptions.push(view);

  const refresh = () => void provider.refresh();
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(refresh),
    workspace.onDidSaveTextDocument(refresh),
    workspace.onDidChangeTextDocument(() => provider.scheduleRefresh()),
    format2Client.onNotification(LSNotificationIdentifiers.TOOL_RESOLUTION_FAILED, refresh)
  );

  context.subscriptions.push(
    commands.registerCommand("galaxy-workflows.refreshToolsView", refresh),
    commands.registerCommand("galaxy-workflows.revealToolStep", (item: WorkflowToolEntry | { entry?: WorkflowToolEntry }) => {
      const entry = (item as { entry?: WorkflowToolEntry })?.entry ?? (item as WorkflowToolEntry);
      if (entry?.range) revealEntryInEditor(entry);
    }),
    commands.registerCommand(
      "galaxy-workflows.openToolInToolShed",
      (item: WorkflowToolEntry | { entry?: WorkflowToolEntry }) => {
        const entry = (item as { entry?: WorkflowToolEntry })?.entry ?? (item as WorkflowToolEntry);
        if (entry?.toolshedUrl) openEntryInToolShed(entry);
      }
    )
  );

  // Initial population once the clients are up.
  refresh();
}

function initGitProvider(context: ExtensionContext): BuiltinGitProvider {
  const gitProvider = new BuiltinGitProvider();
  gitProvider.initialize().then(() => {
    commands.executeCommand("setContext", "galaxy-workflows.gitProviderInitialized", gitProvider.isInitialized);
    console.log(`${context.extension.id} Git initialized is ${gitProvider.isInitialized}.`);
  });
  return gitProvider;
}

async function startLanguageClient(context: ExtensionContext, languageClient: BaseLanguageClient): Promise<void> {
  await languageClient.start();
  console.log(`${context.extension.id} ${languageClient.outputChannel.name} server is ready.`);
}

function setupProviders(context: ExtensionContext, client: BaseLanguageClient, gitProvider: GitProvider): void {
  const cleanWorkflowProvider = new CleanWorkflowProvider(client, gitProvider);
  CleanWorkflowDocumentProvider.register(context, cleanWorkflowProvider);
}
