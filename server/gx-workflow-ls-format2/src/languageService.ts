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

/**
 * A wrapper around the YAML Language Service to support language features
 * for gxformat2 Galaxy workflow files.
 */
export class GxFormat2WorkflowLanguageService extends WorkflowLanguageService {
  private _yamlLanguageService: LanguageService;
  constructor() {
    super();
    this._yamlLanguageService = getLanguageService();
  }

  public override parseWorkflowDocument(document: TextDocument): WorkflowDocument {
    return new GxFormat2WorkflowDocument(document);
  }

  public override format(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[] {
    return [];
  }

  public override async doHover(workflowDocument: WorkflowDocument, position: Position): Promise<Hover | null> {
    return null;
  }

  public override async doComplete(
    workflowDocument: WorkflowDocument,
    position: Position
  ): Promise<CompletionList | null> {
    return null;
  }

  protected override async doValidation(workflowDocument: WorkflowDocument): Promise<Diagnostic[]> {
    return [];
  }
}
