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
import { WorkflowTestsHoverService } from "./services/hover";
import { TYPES } from "./types";
import { WorkflowTestsValidationService } from "./services/validation";

const LANGUAGE_ID = "gxwftests";

/**
 * A custom implementation of the YAML Language Service to support language features
 * for Galaxy workflow test files.
 */
@injectable()
export class GxWorkflowTestsLanguageServiceImpl extends LanguageServiceBase<WorkflowTestsDocument> {
  constructor(
    @inject(YAML_TYPES.YAMLLanguageService) protected yamlLanguageService: YAMLLanguageService,
    @inject(TYPES.WorkflowTestsHoverService) protected hoverService: WorkflowTestsHoverService,
    @inject(TYPES.WorkflowTestsValidationService) protected validationService: WorkflowTestsValidationService
  ) {
    super(LANGUAGE_ID);
  }

  public override parseDocument(document: TextDocument): GxWorkflowTestsDocument {
    const yamlDocument = this.yamlLanguageService.parseYAMLDocument(document);
    return new GxWorkflowTestsDocument(document, yamlDocument);
  }

  public override format(document: TextDocument, _: Range, options: FormattingOptions): TextEdit[] {
    return this.yamlLanguageService.doFormat(document, options);
  }

  public override doHover(documentContext: WorkflowTestsDocument, position: Position): Promise<Hover | null> {
    return this.hoverService.doHover(documentContext, position);
  }

  public override doComplete(
    documentContext: WorkflowTestsDocument,
    position: Position
  ): Promise<CompletionList | null> {
    // TODO: Implement completion
    return Promise.resolve(null);
  }

  protected override async doValidation(documentContext: WorkflowTestsDocument): Promise<Diagnostic[]> {
    return this.validationService.doValidation(documentContext);
  }
}
