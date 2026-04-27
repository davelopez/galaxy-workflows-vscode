import { window } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { CustomCommand, getCommandFullIdentifier } from ".";
import { DiagramPreviewPanelManager } from "../providers/diagramPreviewPanelManager";

export class PreviewMermaidDiagramCommand extends CustomCommand {
  public static id = getCommandFullIdentifier("previewMermaidDiagram");
  readonly identifier = PreviewMermaidDiagramCommand.id;

  constructor(client: BaseLanguageClient, private readonly panelManager: DiagramPreviewPanelManager) {
    super(client);
  }

  async execute(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) return;
    await this.panelManager.openOrFocus(editor.document, "mermaid");
  }
}
