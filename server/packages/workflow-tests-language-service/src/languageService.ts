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
import { YAMLLanguageService } from "@gxwf/yaml-language-service/src/yamlLanguageService";
import { GxWorkflowTestsDocument } from "./document";
import { inject, injectable } from "inversify";
import { TYPES as YAML_TYPES } from "@gxwf/yaml-language-service/src/inversify.config";

@injectable()
export class GxWorkflowTestsLanguageServiceImpl extends LanguageServiceBase<WorkflowTestsDocument> {
  private _yamlLanguageService: YAMLLanguageService;

  constructor(@inject(YAML_TYPES.YAMLLanguageService) yamlLanguageService: YAMLLanguageService) {
    super("gxwftests");
    this._yamlLanguageService = yamlLanguageService;
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
