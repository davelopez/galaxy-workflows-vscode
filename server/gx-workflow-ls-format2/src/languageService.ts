import {
  TextDocument,
  Range,
  FormattingOptions,
  TextEdit,
  WorkflowDocument,
  WorkflowLanguageService,
  Position,
  Hover,
  CompletionList,
  Diagnostic,
  WorkflowValidator,
} from "@gxwf/server-common/src/languageTypes";
import { LanguageService, getLanguageService } from "@gxwf/yaml-language-service/src/yamlLanguageService";
import { GxFormat2WorkflowDocument } from "./gxFormat2WorkflowDocument";
import { GalaxyWorkflowFormat2SchemaLoader } from "./schema";
import { GxFormat2CompletionService } from "./services/completionService";
import { GxFormat2HoverService } from "./services/hoverService";
import { GxFormat2SchemaValidationService, WorkflowValidationService } from "./services/validation";

/**
 * A wrapper around the YAML Language Service to support language features
 * for gxformat2 Galaxy workflow files.
 */
export class GxFormat2WorkflowLanguageService extends WorkflowLanguageService {
  private _yamlLanguageService: LanguageService;
  private _schemaLoader: GalaxyWorkflowFormat2SchemaLoader;
  private _hoverService: GxFormat2HoverService;
  private _completionService: GxFormat2CompletionService;
  private _validationServices: WorkflowValidator[];
  constructor() {
    super();
    this._schemaLoader = new GalaxyWorkflowFormat2SchemaLoader();
    this._yamlLanguageService = getLanguageService();
    this._hoverService = new GxFormat2HoverService(this._schemaLoader.nodeResolver);
    this._completionService = new GxFormat2CompletionService(this._schemaLoader.nodeResolver);
    this._validationServices = [
      new GxFormat2SchemaValidationService(this._schemaLoader.nodeResolver),
      new WorkflowValidationService(),
    ];
  }

  public override parseWorkflowDocument(document: TextDocument): WorkflowDocument {
    const yamlDocument = this._yamlLanguageService.parseYAMLDocument(document);
    return new GxFormat2WorkflowDocument(document, yamlDocument);
  }

  public override format(document: TextDocument, _: Range, options: FormattingOptions): TextEdit[] {
    return this._yamlLanguageService.doFormat(document, options);
  }

  public override doHover(workflowDocument: WorkflowDocument, position: Position): Promise<Hover | null> {
    return this._hoverService.doHover(workflowDocument.textDocument, position, workflowDocument.nodeManager);
  }

  public override async doComplete(
    workflowDocument: WorkflowDocument,
    position: Position
  ): Promise<CompletionList | null> {
    return this._completionService.doComplete(workflowDocument.textDocument, position, workflowDocument.nodeManager);
  }

  protected override async doValidation(workflowDocument: WorkflowDocument): Promise<Diagnostic[]> {
    const format2WorkflowDocument = workflowDocument as GxFormat2WorkflowDocument;
    const diagnostics = await this._yamlLanguageService.doValidation(format2WorkflowDocument.yamlDocument);
    for (const validator of this._validationServices) {
      const results = await validator.doValidation(workflowDocument);
      diagnostics.push(...results);
    }
    return diagnostics;
  }
}
