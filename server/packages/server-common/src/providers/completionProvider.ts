import { CompletionList, CompletionParams } from "vscode-languageserver";
import { GalaxyWorkflowLanguageServer } from "../server";
import { Provider } from "./provider";

export class CompletionProvider extends Provider {
  public static register(server: GalaxyWorkflowLanguageServer): CompletionProvider {
    return new CompletionProvider(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.connection.onCompletion(async (params) => this.onCompletion(params));
  }
  private async onCompletion(params: CompletionParams): Promise<CompletionList | null> {
    const workflowDocument = this.documentsCache.get(params.textDocument.uri);
    if (workflowDocument) {
      const result = await this.workflowLanguageService.doComplete(workflowDocument, params.position);
      return result;
    }
    return null;
  }
}
