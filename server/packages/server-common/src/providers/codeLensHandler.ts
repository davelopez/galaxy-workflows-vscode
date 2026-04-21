import type { CodeLens, CodeLensParams } from "vscode-languageserver";
import { GalaxyWorkflowLanguageServer } from "../languageTypes";
import { ServerEventHandler } from "./handler";

export class CodeLensHandler extends ServerEventHandler {
  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.register(this.server.connection.onCodeLens((params) => this.onCodeLens(params)));
  }

  private async onCodeLens(params: CodeLensParams): Promise<CodeLens[]> {
    const documentContext = this.server.documentsCache.get(params.textDocument.uri);
    if (!documentContext) return [];
    const languageService = this.server.getLanguageServiceById(documentContext.languageId);
    return languageService.doCodeLens(documentContext);
  }
}
