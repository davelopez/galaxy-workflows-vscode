import { Disposable, ExtensionContext, TextDocument, Uri, ViewColumn, WebviewPanel, window, workspace } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { Constants } from "../common/constants";
import {
  DiagramFormat,
  LSRequestIdentifiers,
  RenderWorkflowDiagramParams,
  RenderWorkflowDiagramResult,
} from "../languageTypes";
import { RenderScheduler } from "./renderScheduler";

interface PanelEntry {
  panel: WebviewPanel;
  document: TextDocument;
  format: DiagramFormat;
  disposables: Disposable[];
  /** Monotonic counter incremented per render() call; used to drop stale
   *  in-flight LSP responses so we never post older output after newer. */
  renderSeq: number;
}

const RENDER_DEBOUNCE_MS = 400;

const FORMAT_LABEL: Record<DiagramFormat, string> = {
  mermaid: "Mermaid",
  cytoscape: "Cytoscape",
};

/**
 * Owns the WebviewPanel lifecycle for diagram previews. One panel per
 * (document URI, format) pair. Re-invoking `openOrFocus` reveals the
 * existing panel instead of creating a duplicate.
 */
export class DiagramPreviewPanelManager implements Disposable {
  private readonly panels = new Map<string, PanelEntry>();
  private readonly scheduler: RenderScheduler;

  constructor(
    private readonly context: ExtensionContext,
    private readonly nativeClient: BaseLanguageClient,
    private readonly gxFormat2Client: BaseLanguageClient
  ) {
    this.scheduler = new RenderScheduler(RENDER_DEBOUNCE_MS);
  }

  public async openOrFocus(document: TextDocument, format: DiagramFormat): Promise<void> {
    const key = this.keyFor(document.uri, format);
    const existing = this.panels.get(key);
    if (existing) {
      existing.panel.reveal();
      return;
    }
    const panel = window.createWebviewPanel(
      "galaxyWorkflowDiagram",
      `${FORMAT_LABEL[format]}: ${this.shortName(document.uri)}`,
      ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          Uri.joinPath(this.context.extensionUri, "client/dist/media/diagram"),
          Uri.joinPath(this.context.extensionUri, "client/media/diagram"),
        ],
      }
    );
    panel.webview.html = await this.buildHtml(panel, format);

    const entry: PanelEntry = { panel, document, format, disposables: [], renderSeq: 0 };
    this.panels.set(key, entry);

    entry.disposables.push(
      panel.webview.onDidReceiveMessage((msg: { type?: string; message?: string }) => {
        if (msg?.type === "ready") {
          void this.render(entry);
        } else if (msg?.type === "error") {
          console.error(`[diagramPreview:${format}] webview error:`, msg.message);
        }
      }),
      workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() !== entry.document.uri.toString()) return;
        this.scheduler.schedule(key, () => void this.render(entry));
      }),
      workspace.onDidCloseTextDocument((doc) => {
        if (doc.uri.toString() === entry.document.uri.toString()) {
          entry.panel.dispose();
        }
      })
    );
    panel.onDidDispose(() => this.cleanup(key), undefined, this.context.subscriptions);
  }

  public dispose(): void {
    this.scheduler.dispose();
    for (const entry of this.panels.values()) {
      entry.disposables.forEach((d) => d.dispose());
      entry.panel.dispose();
    }
    this.panels.clear();
  }

  private cleanup(key: string): void {
    const entry = this.panels.get(key);
    if (!entry) return;
    this.scheduler.cancel(key);
    entry.disposables.forEach((d) => d.dispose());
    this.panels.delete(key);
  }

  private async render(entry: PanelEntry): Promise<void> {
    const client = this.clientFor(entry.document);
    const params: RenderWorkflowDiagramParams = {
      contents: entry.document.getText(),
      format: entry.format,
      options: { comments: true },
    };
    const seq = ++entry.renderSeq;
    try {
      const result = await client.sendRequest<RenderWorkflowDiagramResult>(
        LSRequestIdentifiers.RENDER_WORKFLOW_DIAGRAM,
        params
      );
      if (seq !== entry.renderSeq) return; // a newer render() superseded us
      entry.panel.webview.postMessage({
        type: "render",
        format: entry.format,
        payload: result?.contents ?? "",
        error: result?.error,
      });
    } catch (err) {
      if (seq !== entry.renderSeq) return;
      entry.panel.webview.postMessage({
        type: "render",
        format: entry.format,
        payload: "",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private clientFor(document: TextDocument): BaseLanguageClient {
    return document.languageId === Constants.NATIVE_WORKFLOW_LANGUAGE_ID ? this.nativeClient : this.gxFormat2Client;
  }

  private keyFor(uri: Uri, format: DiagramFormat): string {
    return `${uri.toString()}::${format}`;
  }

  private shortName(uri: Uri): string {
    const segs = uri.path.split("/");
    return segs[segs.length - 1] || uri.toString();
  }

  private async buildHtml(panel: WebviewPanel, format: DiagramFormat): Promise<string> {
    const templateUri = Uri.joinPath(this.context.extensionUri, "client/media/diagram", `${format}.html`);
    const bytes = await workspace.fs.readFile(templateUri);
    const template = new TextDecoder("utf-8").decode(bytes);
    const mainJs = panel.webview.asWebviewUri(
      Uri.joinPath(this.context.extensionUri, "client/dist/media/diagram", `${format}.global.js`)
    );
    const sharedCss = panel.webview.asWebviewUri(
      Uri.joinPath(this.context.extensionUri, "client/media/diagram", "shared.css")
    );
    return template
      .replace(/\{\{cspSource\}\}/g, panel.webview.cspSource)
      .replace(/\{\{mainJs\}\}/g, mainJs.toString())
      .replace(/\{\{sharedCss\}\}/g, sharedCss.toString());
  }

  /** Test seam — returns the live entry for a given doc+format, if any. */
  public _entryForTest(uri: Uri, format: DiagramFormat): PanelEntry | undefined {
    return this.panels.get(this.keyFor(uri, format));
  }
}
