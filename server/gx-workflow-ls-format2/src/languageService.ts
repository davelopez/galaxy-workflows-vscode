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
} from "@gxwf/server-common/src/languageTypes";
import { TYPES as YAML_TYPES } from "@gxwf/yaml-language-service/src/inversify.config";
import { YAMLLanguageService } from "@gxwf/yaml-language-service/src/yamlLanguageService";
import { inject, injectable } from "inversify";
import { GxFormat2WorkflowDocument } from "./gxFormat2WorkflowDocument";
import { GxFormat2BasicValidationProfile, GxFormat2IWCValidationProfile } from "./profiles";
import { GalaxyWorkflowFormat2SchemaLoader } from "./schema";
import { GxFormat2CompletionService } from "./services/completionService";
import { GxFormat2HoverService } from "./services/hoverService";
import { GxFormat2SchemaValidationService } from "./services/schemaValidationService";

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
  private _schemaValidationService: GxFormat2SchemaValidationService;

  constructor(
    @inject(YAML_TYPES.YAMLLanguageService) yamlLanguageService: YAMLLanguageService,
    @inject(TYPES.SymbolsProvider) private symbolsProvider: SymbolsProvider
  ) {
    super(LANGUAGE_ID);
    this._schemaLoader = new GalaxyWorkflowFormat2SchemaLoader();
    this._yamlLanguageService = yamlLanguageService;
    this._hoverService = new GxFormat2HoverService(this._schemaLoader.nodeResolver);
    this._completionService = new GxFormat2CompletionService(this._schemaLoader.nodeResolver);
    this._schemaValidationService = new GxFormat2SchemaValidationService(this._schemaLoader.nodeResolver);
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

  protected override initializeValidationProfiles(): void {
    super.initializeValidationProfiles();
    this.validationProfiles.set("basic", new GxFormat2BasicValidationProfile());
    this.validationProfiles.set("iwc", new GxFormat2IWCValidationProfile());
  }

  protected override async doValidation(documentContext: GxFormat2WorkflowDocument): Promise<Diagnostic[]> {
    const syntaxDiagnostics = await this._yamlLanguageService.doValidation(documentContext.yamlDocument);
    syntaxDiagnostics.forEach((diagnostic) => {
      diagnostic.source = "YAML Syntax";
    });
    const schemaDiagnostics = await this._schemaValidationService.doValidation(documentContext);
    schemaDiagnostics.forEach((diagnostic) => {
      diagnostic.source = "Format2 Schema";
    });
    return syntaxDiagnostics.concat(schemaDiagnostics);
  }

  public override getSymbols(documentContext: GxFormat2WorkflowDocument): DocumentSymbol[] {
    return this.symbolsProvider.getSymbols(documentContext);
  }
}
