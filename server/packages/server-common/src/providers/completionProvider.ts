import { CompletionList, CompletionParams } from "vscode-languageserver";
import { Provider } from "./provider";
import { GalaxyWorkflowLanguageServer } from "../languageTypes";

export class CompletionProvider extends Provider {
  public static register(server: GalaxyWorkflowLanguageServer): CompletionProvider {
    return new CompletionProvider(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.server.connection.onCompletion(async (params) => this.onCompletion(params));
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
