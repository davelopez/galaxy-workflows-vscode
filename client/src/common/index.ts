import { commands, ExtensionContext, window, workspace } from "vscode";
import { BaseLanguageClient, DocumentSelector, LanguageClientOptions } from "vscode-languageclient";
import { setupCommands } from "../commands/setup";
import { CleanWorkflowDocumentProvider } from "../providers/cleanWorkflowDocumentProvider";
import { CleanWorkflowProvider } from "../providers/cleanWorkflowProvider";
import { GitProvider } from "../providers/git";
import { BuiltinGitProvider } from "../providers/git/gitProvider";
import { WorkflowToolsTreeProvider } from "../providers/workflowToolsTreeProvider";
import { setupRequests } from "../requests/gxworkflows";
import { ToolCacheStatusBar } from "../statusBar";
import { LSNotificationIdentifiers, ToolResolutionFailedParams } from "../languageTypes";

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
  const workflowToolsProvider = new WorkflowToolsTreeProvider(nativeClient, gxFormat2Client);

  // Setup native workflow language features
  setupProviders(context, nativeClient, gitProvider);
  setupCommands(context, nativeClient, gxFormat2Client, gitProvider, workflowToolsProvider);
  startLanguageClient(context, nativeClient);

  // Setup gxformat2 language features
  startLanguageClient(context, gxFormat2Client);

  setupRequests(context, nativeClient, gxFormat2Client);

  // Tool resolution failure notifications. Either server can emit these — the
  // auto-resolution flow runs in whichever server owns the document — so
  // subscribe to both.
  const toolResolutionOutputChannel = window.createOutputChannel("Galaxy Workflows — Tool Resolution");
  context.subscriptions.push(toolResolutionOutputChannel);
  // The warning toast is shown once per session to avoid repeated interruptions
  // if many documents open at startup. All failures are still logged to the
  // output channel regardless.
  let shownResolutionWarning = false;
  const onToolResolutionFailed = (params: ToolResolutionFailedParams): void => {
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
  };
  context.subscriptions.push(
    nativeClient.onNotification(LSNotificationIdentifiers.TOOL_RESOLUTION_FAILED, onToolResolutionFailed),
    gxFormat2Client.onNotification(LSNotificationIdentifiers.TOOL_RESOLUTION_FAILED, onToolResolutionFailed)
  );

  // Tool cache status bar
  const toolCacheStatusBar = new ToolCacheStatusBar(nativeClient);
  toolCacheStatusBar.startPolling();
  context.subscriptions.push(toolCacheStatusBar);

  // Workflow Tools tree view — commands are registered via setupCommands.
  setupWorkflowToolsView(context, workflowToolsProvider, nativeClient, gxFormat2Client);
}

function setupWorkflowToolsView(
  context: ExtensionContext,
  provider: WorkflowToolsTreeProvider,
  nativeClient: BaseLanguageClient,
  format2Client: BaseLanguageClient
): void {
  const view = window.createTreeView("galaxyWorkflows.toolsView", {
    treeDataProvider: provider,
  });
  context.subscriptions.push(view);

  const refresh = (): void => void provider.refresh();
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor(refresh),
    workspace.onDidSaveTextDocument(refresh),
    workspace.onDidChangeTextDocument(() => provider.scheduleRefresh()),
    nativeClient.onNotification(LSNotificationIdentifiers.TOOL_RESOLUTION_FAILED, refresh),
    format2Client.onNotification(LSNotificationIdentifiers.TOOL_RESOLUTION_FAILED, refresh)
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
