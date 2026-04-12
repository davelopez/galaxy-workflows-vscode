import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  Range,
  TextDocumentEdit,
  TextEdit,
} from "vscode-languageserver";
import { GalaxyWorkflowLanguageServer } from "../languageTypes";
import { LEGACY_TOOL_STATE_CODE } from "./validation/toolStateDiagnostics";
import { ServerEventHandler } from "./handler";

export class CodeActionHandler extends ServerEventHandler {
  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.register(this.server.connection.onCodeAction(async (params) => this.onCodeAction(params)));
  }

  private async onCodeAction(params: CodeActionParams): Promise<CodeAction[] | null> {
    const legacyDiags = params.context.diagnostics.filter((d) => d.code === LEGACY_TOOL_STATE_CODE);
    if (legacyDiags.length === 0) return null;

    const docContext = this.server.documentsCache.get(params.textDocument.uri);
    if (!docContext) return null;

    const document = docContext.textDocument;
    const languageService = this.server.getLanguageServiceById(document.languageId);
    const cleanedText = await languageService.cleanWorkflowText(document.getText());

    const fullRange = Range.create(document.positionAt(0), document.positionAt(document.getText().length));
    return [
      {
        title: "Clean workflow (convert tool_state to object form)",
        kind: CodeActionKind.QuickFix,
        isPreferred: true,
        diagnostics: legacyDiags,
        edit: {
          documentChanges: [
            TextDocumentEdit.create(
              { uri: params.textDocument.uri, version: document.version },
              [TextEdit.replace(fullRange, cleanedText)]
            ),
          ],
        },
      },
    ];
  }
}
