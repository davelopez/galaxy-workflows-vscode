import {
  FormattingOptions,
  TextDocument,
  TextEdit,
  Position,
  Range,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  GalaxyWorkflowLanguageServer,
} from "../languageTypes";
import { Provider } from "./provider";

export class FormattingProvider extends Provider {
  public static register(server: GalaxyWorkflowLanguageServer): FormattingProvider {
    return new FormattingProvider(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.server.connection.onDocumentFormatting((params) => this.onDocumentFormatting(params));
    this.server.connection.onDocumentRangeFormatting((params) => this.onDocumentRangeFormatting(params));
  }

  public onDocumentFormatting(params: DocumentFormattingParams): TextEdit[] {
    return this.onFormat(params.textDocument.uri, undefined, params.options);
  }

  public onDocumentRangeFormatting(params: DocumentRangeFormattingParams): TextEdit[] {
    return this.onFormat(params.textDocument.uri, params.range, params.options);
  }

  private onFormat(documentUri: string, range: Range | undefined, options: FormattingOptions): TextEdit[] {
    const documentContext = this.server.documentsCache.get(documentUri);
    if (documentContext) {
      const languageService = this.server.getLanguageServiceById(documentContext.languageId);
      const edits = languageService.format(
        documentContext.textDocument,
        range ?? this.getFullRange(documentContext.textDocument),
        options
      );
      return edits;
    }
    return [];
  }

  private getFullRange(document: TextDocument): Range {
    return Range.create(Position.create(0, 0), document.positionAt(document.getText().length));
  }
}
