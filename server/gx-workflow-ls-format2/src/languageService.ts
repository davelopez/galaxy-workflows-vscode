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
} from "@gxwf/server-common/src/languageTypes";
import { LanguageService, getLanguageService } from "@gxwf/yaml-language-service/src/yamlLanguageService";
import { GxFormat2WorkflowDocument } from "./gxFormat2WorkflowDocument";
import { GalaxyWorkflowFormat2SchemaLoader } from "./schema/schemaLoader";
import { GxFormat2HoverService } from "./services/hoverService";

/**
 * A wrapper around the YAML Language Service to support language features
 * for gxformat2 Galaxy workflow files.
 */
export class GxFormat2WorkflowLanguageService extends WorkflowLanguageService {
  private _yamlLanguageService: LanguageService;
  private _schemaLoader: GalaxyWorkflowFormat2SchemaLoader;
  private _hoverService: GxFormat2HoverService;
  constructor() {
    super();
    this._schemaLoader = new GalaxyWorkflowFormat2SchemaLoader();
    this._yamlLanguageService = getLanguageService();
    this._hoverService = new GxFormat2HoverService(this._schemaLoader.resolvedSchema);
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
    return null;
  }

  protected override async doValidation(workflowDocument: WorkflowDocument): Promise<Diagnostic[]> {
    const format2WorkflowDocument = workflowDocument as GxFormat2WorkflowDocument;
    return this._yamlLanguageService.doValidation(format2WorkflowDocument.yamlDocument);
  }
}
