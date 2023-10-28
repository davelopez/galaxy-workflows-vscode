import {
  TextDocument,
  Range,
  FormattingOptions,
  TextEdit,
  LanguageServiceBase,
  Position,
  Hover,
  CompletionList,
  Diagnostic,
  WorkflowTestsDocument,
} from "@gxwf/server-common/src/languageTypes";
import { YAMLLanguageService, getLanguageService } from "@gxwf/yaml-language-service/src/yamlLanguageService";
import { GxWorkflowTestsDocument } from "./document";

export class GxWorkflowTestsLanguageService extends LanguageServiceBase<WorkflowTestsDocument> {
  private _yamlLanguageService: YAMLLanguageService;

  constructor() {
    super("gxwftests");
    this._yamlLanguageService = getLanguageService();
  }

  public override parseDocument(document: TextDocument): GxWorkflowTestsDocument {
    const yamlDocument = this._yamlLanguageService.parseYAMLDocument(document);
    return new GxWorkflowTestsDocument(document, yamlDocument);
  }

  public override format(document: TextDocument, _: Range, options: FormattingOptions): TextEdit[] {
    return this._yamlLanguageService.doFormat(document, options);
  }

  public override doHover(documentContext: WorkflowTestsDocument, position: Position): Promise<Hover | null> {
    // TODO: Implement hover
    return Promise.resolve(null);
  }

  public override doComplete(
    documentContext: WorkflowTestsDocument,
    position: Position
  ): Promise<CompletionList | null> {
    // TODO: Implement completion
    return Promise.resolve(null);
  }

  protected override async doValidation(documentContext: WorkflowTestsDocument): Promise<Diagnostic[]> {
    // TODO: Implement validation
    return Promise.resolve([]);
  }
}
