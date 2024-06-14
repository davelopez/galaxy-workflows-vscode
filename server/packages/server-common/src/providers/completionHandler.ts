import { CompletionList, CompletionParams } from "vscode-languageserver";
import { GalaxyWorkflowLanguageServer } from "../languageTypes";
import { ServerEventHandler } from "./handler";

export class CompletionHandler extends ServerEventHandler {
  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.register(this.server.connection.onCompletion(async (params) => this.onCompletion(params)));
  }

  private async onCompletion(params: CompletionParams): Promise<CompletionList | null> {
    const documentContext = this.server.documentsCache.get(params.textDocument.uri);
    if (documentContext) {
      const languageService = this.server.getLanguageServiceById(documentContext.languageId);
      const result = await languageService.doComplete(documentContext, params.position);
      return result;
    }
    return null;
  }
}
