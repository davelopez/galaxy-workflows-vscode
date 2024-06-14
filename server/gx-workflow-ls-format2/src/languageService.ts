import {
  CompletionList,
  Diagnostic,
  DocumentSymbol,
  FormattingOptions,
  Hover,
  LanguageService,
  LanguageServiceBase,
  Position,
  Range,
  SymbolsProvider,
  TYPES,
  TextDocument,
  TextEdit,
  WorkflowValidator,
} from "@gxwf/server-common/src/languageTypes";
import { TYPES as YAML_TYPES } from "@gxwf/yaml-language-service/src/inversify.config";
import { YAMLLanguageService } from "@gxwf/yaml-language-service/src/yamlLanguageService";
import { inject, injectable } from "inversify";
import { GxFormat2WorkflowDocument } from "./gxFormat2WorkflowDocument";
import { GalaxyWorkflowFormat2SchemaLoader } from "./schema";
import { GxFormat2CompletionService } from "./services/completionService";
import { GxFormat2HoverService } from "./services/hoverService";
import { GxFormat2SchemaValidationService, WorkflowValidationService } from "./services/validation";

const LANGUAGE_ID = "gxformat2";

export interface GxFormat2WorkflowLanguageService extends LanguageService<GxFormat2WorkflowDocument> {}

/**
 * A wrapper around the YAML Language Service to support language features
 * for gxformat2 Galaxy workflow files.
 */
@injectable()
export class GxFormat2WorkflowLanguageServiceImpl
  extends LanguageServiceBase<GxFormat2WorkflowDocument>
  implements GxFormat2WorkflowLanguageService
{
  private _yamlLanguageService: YAMLLanguageService;
  private _schemaLoader: GalaxyWorkflowFormat2SchemaLoader;
  private _hoverService: GxFormat2HoverService;
  private _completionService: GxFormat2CompletionService;
  private _validationServices: WorkflowValidator[];

  constructor(
    @inject(YAML_TYPES.YAMLLanguageService) yamlLanguageService: YAMLLanguageService,
    @inject(TYPES.SymbolsProvider) private symbolsProvider: SymbolsProvider
  ) {
    super(LANGUAGE_ID);
    this._schemaLoader = new GalaxyWorkflowFormat2SchemaLoader();
    this._yamlLanguageService = yamlLanguageService;
    this._hoverService = new GxFormat2HoverService(this._schemaLoader.nodeResolver);
    this._completionService = new GxFormat2CompletionService(this._schemaLoader.nodeResolver);
    this._validationServices = [
      new GxFormat2SchemaValidationService(this._schemaLoader.nodeResolver),
      new WorkflowValidationService(),
    ];
  }

  public override parseDocument(document: TextDocument): GxFormat2WorkflowDocument {
    const yamlDocument = this._yamlLanguageService.parseYAMLDocument(document);
    return new GxFormat2WorkflowDocument(document, yamlDocument);
  }

  public override format(document: TextDocument, _: Range, options: FormattingOptions): TextEdit[] {
    return this._yamlLanguageService.doFormat(document, options);
  }

  public override doHover(documentContext: GxFormat2WorkflowDocument, position: Position): Promise<Hover | null> {
    return this._hoverService.doHover(documentContext, position);
  }

  public override async doComplete(
    documentContext: GxFormat2WorkflowDocument,
    position: Position
  ): Promise<CompletionList | null> {
    return this._completionService.doComplete(documentContext, position);
  }

  protected override async doValidation(documentContext: GxFormat2WorkflowDocument): Promise<Diagnostic[]> {
    const diagnostics = await this._yamlLanguageService.doValidation(documentContext.yamlDocument);
    for (const validator of this._validationServices) {
      const results = await validator.doValidation(documentContext);
      diagnostics.push(...results);
    }
    return diagnostics;
  }

  public override getSymbols(documentContext: GxFormat2WorkflowDocument): DocumentSymbol[] {
    return this.symbolsProvider.getSymbols(documentContext);
  }
}
