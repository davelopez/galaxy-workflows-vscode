import { DocumentSymbol, DocumentSymbolParams, GalaxyWorkflowLanguageServer } from "../languageTypes";
import { ServerEventHandler } from "./handler";

export class SymbolsHandler extends ServerEventHandler {
  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.register(this.server.connection.onDocumentSymbol((params) => this.onDocumentSymbol(params)));
  }

  public onDocumentSymbol(params: DocumentSymbolParams): DocumentSymbol[] {
    const documentContext = this.server.documentsCache.get(params.textDocument.uri);
    if (documentContext) {
      const languageService = this.server.getLanguageServiceById(documentContext.languageId);
      const result = languageService.getSymbols(documentContext);
      return result;
    }
    return [];
  }
}
