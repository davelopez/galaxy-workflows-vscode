import { window } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { CustomCommand, getCommandFullIdentifier } from ".";
import { DiagramPreviewPanelManager } from "../providers/diagramPreviewPanelManager";

export class PreviewMermaidDiagramCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("previewMermaidDiagram");
  readonly identifier = PreviewMermaidDiagramCommand.id;

  // The base CustomCommand requires a BaseLanguageClient, but client selection
  // for this command happens inside the panel manager (by document languageId),
  // so the inherited `this.client` is unused here. We pass nativeClient to
  // satisfy the parent constructor and keep the convention used by other
  // dual-language commands (e.g. InsertToolStepCommand).
  constructor(
    nativeClient: BaseLanguageClient,
    private readonly panelManager: DiagramPreviewPanelManager
  ) {
    super(nativeClient);
  }

  async execute(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) return;
    await this.panelManager.openOrFocus(editor.document, "mermaid");
  }
}
