import {
  FormattingOptions,
  TextDocument,
  TextEdit,
  Position,
  Range,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
} from "../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../server";
import { Provider } from "./provider";

export class FormattingProvider extends Provider {
  public static register(server: GalaxyWorkflowLanguageServer): FormattingProvider {
    return new FormattingProvider(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.connection.onDocumentFormatting((params) => this.onDocumentFormatting(params));
    this.connection.onDocumentRangeFormatting((params) => this.onDocumentRangeFormatting(params));
  }

  public onDocumentFormatting(params: DocumentFormattingParams): TextEdit[] {
    return this.onFormat(params.textDocument.uri, undefined, params.options);
  }

  public onDocumentRangeFormatting(params: DocumentRangeFormattingParams): TextEdit[] {
    return this.onFormat(params.textDocument.uri, params.range, params.options);
  }

  private onFormat(documentUri: string, range: Range | undefined, options: FormattingOptions): TextEdit[] {
    const workflowDocument = this.documentsCache.get(documentUri);
    if (workflowDocument) {
      const edits = this.workflowLanguageService.format(
        workflowDocument.textDocument,
        range ?? this.getFullRange(workflowDocument.textDocument),
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
