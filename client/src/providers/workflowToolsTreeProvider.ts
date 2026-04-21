import {
  Event,
  EventEmitter,
  MarkdownString,
  Position,
  Range,
  Selection,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  env,
  window,
} from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import {
  GetWorkflowToolsParams,
  GetWorkflowToolsResult,
  LSRequestIdentifiers,
  WorkflowToolEntry,
} from "../languageTypes";
import { isNativeWorkflowDocument, isWorkflowDocument } from "../common/utils";

const WORKFLOW_TOOL_CONTEXT = "workflowTool";

export class WorkflowToolItem extends TreeItem {
  constructor(public readonly entry: WorkflowToolEntry) {
    const displayName = entry.name ?? entry.toolId;
    super(displayName, TreeItemCollapsibleState.None);
    this.description = entry.toolVersion;
    this.iconPath = iconForEntry(entry);
    this.tooltip = buildTooltip(entry);
    this.contextValue = WORKFLOW_TOOL_CONTEXT;
  }
}

function iconForEntry(entry: WorkflowToolEntry): ThemeIcon {
  if (entry.resolutionFailed) return new ThemeIcon("error");
  if (entry.cached) return new ThemeIcon("check");
  return new ThemeIcon("info");
}

function buildTooltip(entry: WorkflowToolEntry): MarkdownString {
  const md = new MarkdownString();
  md.isTrusted = false;
  md.appendMarkdown(`**${entry.name ?? entry.toolId}**`);
  if (entry.toolVersion) md.appendMarkdown(` · \`${entry.toolVersion}\``);
  md.appendMarkdown("\n\n");
  md.appendMarkdown(`\`${entry.toolId}\``);
  if (entry.description) md.appendMarkdown(`\n\n${entry.description}`);
  if (!entry.cached) md.appendMarkdown("\n\n_Tool not cached — run **Populate Tool Cache**._");
  if (entry.resolutionFailed) md.appendMarkdown("\n\n_Could not resolve from ToolShed._");
  if (entry.toolshedUrl) md.appendMarkdown(`\n\n[Open in ToolShed](${entry.toolshedUrl})`);
  return md;
}

export class WorkflowToolsTreeProvider implements TreeDataProvider<WorkflowToolItem> {
  private readonly _onDidChangeTreeData = new EventEmitter<WorkflowToolItem | undefined>();
  readonly onDidChangeTreeData: Event<WorkflowToolItem | undefined> = this._onDidChangeTreeData.event;

  private _entries: WorkflowToolEntry[] = [];
  private _debounceHandle: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly nativeClient: BaseLanguageClient,
    private readonly format2Client: BaseLanguageClient
  ) {}

  getTreeItem(element: WorkflowToolItem): TreeItem {
    return element;
  }

  getChildren(): WorkflowToolItem[] {
    return this._entries.map((e) => new WorkflowToolItem(e));
  }

  public scheduleRefresh(delayMs = 500): void {
    if (this._debounceHandle) clearTimeout(this._debounceHandle);
    this._debounceHandle = setTimeout(() => void this.refresh(), delayMs);
  }

  public async refresh(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor || !isWorkflowDocument(editor.document.uri)) {
      this._entries = [];
      this._onDidChangeTreeData.fire(undefined);
      return;
    }

    const client = isNativeWorkflowDocument(editor.document.uri) ? this.nativeClient : this.format2Client;
    const params: GetWorkflowToolsParams = { uri: editor.document.uri.toString() };
    try {
      const result = await client.sendRequest<GetWorkflowToolsResult>(
        LSRequestIdentifiers.GET_WORKFLOW_TOOLS,
        params
      );
      this._entries = result?.tools ?? [];
    } catch {
      this._entries = [];
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Test hook: inject entries directly without a client round-trip. */
  public _setEntriesForTest(entries: WorkflowToolEntry[]): void {
    this._entries = entries;
    this._onDidChangeTreeData.fire(undefined);
  }
}

export function revealEntryInEditor(entry: WorkflowToolEntry): void {
  const editor = window.activeTextEditor;
  if (!editor) return;
  const range = new Range(
    new Position(entry.range.start.line, entry.range.start.character),
    new Position(entry.range.end.line, entry.range.end.character)
  );
  editor.revealRange(range);
  editor.selection = new Selection(range.start, range.start);
}

export function openEntryInToolShed(entry: WorkflowToolEntry): void {
  if (!entry.toolshedUrl) return;
  env.openExternal(Uri.parse(entry.toolshedUrl));
}
