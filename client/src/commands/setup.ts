import { ExtensionContext } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { CleanWorkflowProvider } from "../providers/cleanWorkflowProvider";
import { ConvertedWorkflowDocumentProvider } from "../providers/convertedWorkflowDocumentProvider";
import { GitProvider } from "../providers/git";
import { CleanWorkflowCommand } from "./cleanWorkflow";
import { CompareCleanWithWorkflowsCommand } from "./compareCleanWith";
import { ConvertFileToFormat2Command, ConvertFileToNativeCommand } from "./convertFile";
import { PreviewConvertToFormat2Command, PreviewConvertToNativeCommand } from "./convertWorkflow";
import { ExportToFormat2Command, ExportToNativeCommand } from "./exportWorkflow";
import { OpenToolInToolShedCommand } from "./openToolInToolShed";
import { PopulateToolCacheCommand } from "./populateToolCache";
import { PopulateToolCacheForToolCommand } from "./populateToolCacheForTool";
import { PreviewCleanWorkflowCommand } from "./previewCleanWorkflow";
import { RefreshToolsViewCommand } from "./refreshToolsView";
import { RevealToolStepCommand } from "./revealToolStep";
import { SelectForCleanCompareCommand } from "./selectForCleanCompare";
import { WorkflowToolsTreeProvider } from "../providers/workflowToolsTreeProvider";

/**
 * Registers all custom commands declared in package.json.
 * Conversion commands route to the server that owns the source format:
 * toFormat2 → nativeClient (native .ga source), toNative → gxFormat2Client
 * (format2 .gxwf.yml source).
 */
export function setupCommands(
  context: ExtensionContext,
  nativeClient: BaseLanguageClient,
  gxFormat2Client: BaseLanguageClient,
  gitProvider: GitProvider,
  workflowToolsProvider: WorkflowToolsTreeProvider
): void {
  const convertedProvider = ConvertedWorkflowDocumentProvider.register(context);

  // Conversion: preview (diff view, no file written)
  context.subscriptions.push(new PreviewConvertToFormat2Command(nativeClient, convertedProvider).register());
  context.subscriptions.push(new PreviewConvertToNativeCommand(gxFormat2Client, convertedProvider).register());

  // Conversion: export (clean + convert, write new file alongside original)
  context.subscriptions.push(new ExportToFormat2Command(nativeClient).register());
  context.subscriptions.push(new ExportToNativeCommand(gxFormat2Client).register());

  // Conversion: convert file in-place (clean + convert, replace original)
  context.subscriptions.push(new ConvertFileToFormat2Command(nativeClient).register());
  context.subscriptions.push(new ConvertFileToNativeCommand(gxFormat2Client).register());

  context.subscriptions.push(new PreviewCleanWorkflowCommand(nativeClient).register());
  context.subscriptions.push(new CleanWorkflowCommand(nativeClient).register());
  context.subscriptions.push(new PopulateToolCacheCommand(nativeClient).register());
  context.subscriptions.push(new PopulateToolCacheForToolCommand(nativeClient, gxFormat2Client).register());
  context.subscriptions.push(new RefreshToolsViewCommand(nativeClient, workflowToolsProvider).register());
  context.subscriptions.push(new RevealToolStepCommand(nativeClient).register());
  context.subscriptions.push(new OpenToolInToolShedCommand(nativeClient).register());
  const selectForCompareProvider = new SelectForCleanCompareCommand(nativeClient);
  context.subscriptions.push(selectForCompareProvider.register());
  context.subscriptions.push(
    new CompareCleanWithWorkflowsCommand(
      nativeClient,
      selectForCompareProvider,
      new CleanWorkflowProvider(nativeClient, gitProvider)
    ).register()
  );
}
