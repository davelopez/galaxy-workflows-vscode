import {
  env,
  ProgressLocation,
  Position,
  QuickPickItem,
  QuickPickItemButtonEvent,
  Range,
  Selection,
  ThemeIcon,
  Uri,
  window,
  WorkspaceEdit,
  workspace,
} from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { CustomCommand, getCommandFullIdentifier } from ".";
import { isFormat2WorkflowDocument, isNativeWorkflowDocument } from "../common/utils";
import {
  GetStepSkeletonParams,
  GetStepSkeletonResult,
  LSRequestIdentifiers,
  SearchToolsParams,
  SearchToolsResult,
  ToolSearchHit,
} from "../languageTypes";
import { insertFormat2Step, insertNativeStep } from "./insertToolStepHelpers";

interface ToolHitQuickPickItem extends QuickPickItem {
  hit: ToolSearchHit;
}

/**
 * Optional args accepted by the command — used by tests (and potentially by
 * other commands / code actions) to drive the pipeline without UI prompts.
 * When both `query` and `autoPickToolIdContains` are supplied, the input box
 * and QuickPick are skipped and the first matching hit is used.
 */
export interface InsertToolStepArgs {
  query?: string;
  autoPickToolIdContains?: string;
}

/**
 * Prompt for a search term, list matching tools in a QuickPick, then insert a
 * step skeleton for the picked tool into the current workflow document.
 */
export class InsertToolStepCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("insertToolStep");
  readonly identifier: string = InsertToolStepCommand.id;

  private _inFlight = false;
  private readonly format2Client: BaseLanguageClient;

  constructor(nativeClient: BaseLanguageClient, format2Client: BaseLanguageClient) {
    super(nativeClient);
    this.format2Client = format2Client;
  }

  async execute(args: unknown[] = []): Promise<void> {
    if (this._inFlight) return;
    const editor = window.activeTextEditor;
    if (!editor) {
      window.showErrorMessage("Open a Galaxy workflow document to insert a tool step.");
      return;
    }
    const format = resolveFormat(editor.document.uri);
    if (!format) {
      window.showErrorMessage("Insert Tool Step only works on .ga or .gxwf.yml documents.");
      return;
    }
    const client = format === "native" ? this.client : this.format2Client;
    const invokeArgs = (args[0] as InsertToolStepArgs | undefined) ?? {};

    this._inFlight = true;
    try {
      const query =
        invokeArgs.query ??
        (await window.showInputBox({
          prompt: "Search the ToolShed for a tool to insert",
          placeHolder: "e.g. fastqc, fastp, multiqc",
        }));
      if (!query) return;

      const searchResult = await window.withProgress(
        { location: ProgressLocation.Window, title: `Searching ToolShed for "${query}"…` },
        async () =>
          client.sendRequest<SearchToolsResult>(LSRequestIdentifiers.SEARCH_TOOLS, {
            query,
          } as SearchToolsParams)
      );

      if (!searchResult || searchResult.hits.length === 0) {
        window.showInformationMessage(`No tools matched "${query}".`);
        return;
      }

      const pick = invokeArgs.autoPickToolIdContains
        ? autoPickHit(searchResult.hits, invokeArgs.autoPickToolIdContains)
        : await this.showHitPicker(searchResult.hits, query);
      if (!pick) {
        if (invokeArgs.autoPickToolIdContains) {
          window.showErrorMessage(
            `No hit matched "${invokeArgs.autoPickToolIdContains}" in ${searchResult.hits.length} results for "${query}".`
          );
        }
        return;
      }

      const skeleton = await client.sendRequest<GetStepSkeletonResult>(LSRequestIdentifiers.GET_STEP_SKELETON, {
        toolshedUrl: pick.toolshedUrl,
        trsToolId: pick.trsToolId,
        version: pick.version,
        format,
      } as GetStepSkeletonParams);
      if (!skeleton?.step || skeleton.error) {
        window.showErrorMessage(skeleton?.error ?? "Failed to build step skeleton.");
        return;
      }

      await this.applyInsertEdit(editor.document.uri, format, skeleton.step as Record<string, unknown>);
    } finally {
      this._inFlight = false;
    }
  }

  private async showHitPicker(hits: ToolSearchHit[], query: string): Promise<ToolSearchHit | undefined> {
    return await new Promise<ToolSearchHit | undefined>((resolve) => {
      const picker = window.createQuickPick<ToolHitQuickPickItem>();
      picker.title = `Tool Shed results for "${query}"`;
      picker.placeholder = "Filter results…";
      picker.matchOnDescription = true;
      picker.matchOnDetail = true;
      picker.items = hits.map((hit) => ({
        label: hit.toolName,
        description: `${hit.repoOwnerUsername}/${hit.repoName}${hit.version ? ` · ${hit.version}` : ""}`,
        detail: (hit.toolDescription ?? "").slice(0, 140),
        buttons: [{ iconPath: new ThemeIcon("link-external"), tooltip: "Open in ToolShed" }],
        hit,
      }));

      picker.onDidTriggerItemButton((e: QuickPickItemButtonEvent<ToolHitQuickPickItem>) => {
        const hit = e.item.hit;
        const url = `${hit.toolshedUrl.replace(/\/$/, "")}/view/${hit.repoOwnerUsername}/${hit.repoName}`;
        void env.openExternal(Uri.parse(url));
      });

      picker.onDidAccept(() => {
        const item = picker.selectedItems[0];
        picker.hide();
        resolve(item?.hit);
      });
      picker.onDidHide(() => {
        picker.dispose();
        resolve(undefined);
      });
      picker.show();
    });
  }

  private async applyInsertEdit(uri: Uri, format: "native" | "format2", step: Record<string, unknown>): Promise<void> {
    const document = await workspace.openTextDocument(uri);
    const originalText = document.getText();
    const newText = format === "native" ? insertNativeStep(originalText, step) : insertFormat2Step(originalText, step);
    const edit = new WorkspaceEdit();
    const fullRange = new Range(document.positionAt(0), document.positionAt(originalText.length));
    edit.replace(uri, fullRange, newText);
    const applied = await workspace.applyEdit(edit);
    if (!applied) {
      window.showErrorMessage("Failed to apply workspace edit.");
      return;
    }
    // Move cursor to the inserted tool_id line if we can find it.
    const toolIdMatch =
      newText.indexOf(`"tool_id": "${step.tool_id}"`) !== -1
        ? newText.indexOf(`"tool_id": "${step.tool_id}"`)
        : newText.indexOf(`tool_id: ${step.tool_id}`);
    if (toolIdMatch >= 0) {
      const pos = document.positionAt(toolIdMatch);
      const editor = window.activeTextEditor;
      if (editor && editor.document.uri.toString() === uri.toString()) {
        editor.selection = new Selection(pos, pos);
        editor.revealRange(new Range(pos, new Position(pos.line + 1, 0)));
      }
    }
  }
}

function autoPickHit(hits: ToolSearchHit[], needle: string): ToolSearchHit | undefined {
  return hits.find((h) => h.toolId.includes(needle) || h.trsToolId.includes(needle) || h.fullToolId.includes(needle));
}

function resolveFormat(uri: Uri): "native" | "format2" | undefined {
  if (isNativeWorkflowDocument(uri)) return "native";
  if (isFormat2WorkflowDocument(uri)) return "format2";
  return undefined;
}
