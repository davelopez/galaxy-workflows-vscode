import { commands, Uri, window, workspace } from "vscode";
import { BaseLanguageClient } from "vscode-languageclient";
import { CustomCommand, getCommandFullIdentifier } from ".";
import { Constants } from "../common/constants";
import { fileUriExistsInWorkspace } from "../common/utils";
import {
  DiagramFormat,
  LSRequestIdentifiers,
  RenderWorkflowDiagramParams,
  RenderWorkflowDiagramResult,
} from "../languageTypes";

interface DiagramExportSpec {
  format: DiagramFormat;
  extension: string;
  options?: Record<string, unknown>;
}

const MERMAID_SPEC: DiagramExportSpec = {
  format: "mermaid",
  extension: ".mmd",
  options: { comments: true },
};

/** Strip the workflow extension and append the diagram extension. */
function diagramFileUri(sourceUri: Uri, extension: string): Uri {
  const stripped = sourceUri.path.replace(/\.gxwf\.(yml|yaml)$/, "").replace(/\.ga$/, "");
  return sourceUri.with({ path: `${stripped}${extension}` });
}

abstract class ExportDiagramCommandBase extends CustomCommand {
  // `nativeClient` doubles as the parent's `this.client`; matches the
  // InsertToolStepCommand convention for dual-language commands.
  private readonly format2Client: BaseLanguageClient;

  constructor(nativeClient: BaseLanguageClient, format2Client: BaseLanguageClient) {
    super(nativeClient);
    this.format2Client = format2Client;
  }

  protected abstract readonly spec: DiagramExportSpec;

  async execute(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) return;
    const { document } = editor;
    const client = document.languageId === Constants.NATIVE_WORKFLOW_LANGUAGE_ID ? this.client : this.format2Client;

    const params: RenderWorkflowDiagramParams = {
      contents: document.getText(),
      format: this.spec.format,
      options: this.spec.options,
    };
    let result: RenderWorkflowDiagramResult | undefined;
    try {
      result = await client.sendRequest<RenderWorkflowDiagramResult>(
        LSRequestIdentifiers.RENDER_WORKFLOW_DIAGRAM,
        params
      );
    } catch (err) {
      window.showErrorMessage(`Diagram export failed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (!result || result.error) {
      window.showErrorMessage(`Diagram export failed: ${result?.error ?? "no result"}`);
      return;
    }

    const targetUri = diagramFileUri(document.uri, this.spec.extension);
    if (await fileUriExistsInWorkspace(targetUri)) {
      const targetName = targetUri.path.split("/").pop() ?? targetUri.path;
      const choice = await window.showWarningMessage(`${targetName} already exists. Overwrite?`, "Overwrite", "Cancel");
      if (choice !== "Overwrite") return;
    }

    try {
      await workspace.fs.writeFile(targetUri, Buffer.from(result.contents, "utf8"));
    } catch (err) {
      window.showErrorMessage(`Failed to write diagram: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const targetName = targetUri.path.split("/").pop() ?? targetUri.path;
    void window.showInformationMessage(`Exported ${targetName}`, "Reveal in Explorer").then((action) => {
      if (action === "Reveal in Explorer") {
        void commands.executeCommand("revealInExplorer", targetUri);
      }
    });
  }
}

export class ExportMermaidDiagramCommand extends ExportDiagramCommandBase {
  public static id = getCommandFullIdentifier("exportMermaid");
  readonly identifier = ExportMermaidDiagramCommand.id;
  protected readonly spec = MERMAID_SPEC;
}
