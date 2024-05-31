import {
  CompletionList,
  Diagnostic,
  FormattingOptions,
  Hover,
  LanguageServiceBase,
  Position,
  Range,
  TextDocument,
  TextEdit,
  WorkflowTestsDocument,
} from "@gxwf/server-common/src/languageTypes";
import { TYPES as YAML_TYPES } from "@gxwf/yaml-language-service/src/inversify.config";
import { YAMLLanguageService } from "@gxwf/yaml-language-service/src/yamlLanguageService";
import { inject, injectable } from "inversify";
import { GxWorkflowTestsDocument } from "./document";
import { WorkflowTestsCompletionService } from "./services/completion";
import { WorkflowTestsHoverService } from "./services/hover";
import { WorkflowTestsValidationService } from "./services/validation";
import { TYPES } from "./types";

const LANGUAGE_ID = "gxwftests";

/**
 * A custom implementation of the YAML Language Service to support language features
 * for Galaxy workflow test files.
 * It combines specific services to implement the language features.
 */
@injectable()
export class GxWorkflowTestsLanguageServiceImpl extends LanguageServiceBase<WorkflowTestsDocument> {
  constructor(
    @inject(YAML_TYPES.YAMLLanguageService) protected yamlLanguageService: YAMLLanguageService,
    @inject(TYPES.WorkflowTestsHoverService) protected hoverService: WorkflowTestsHoverService,
    @inject(TYPES.WorkflowTestsCompletionService) protected completionService: WorkflowTestsCompletionService,
    @inject(TYPES.WorkflowTestsValidationService) protected validationService: WorkflowTestsValidationService
  ) {
    super(LANGUAGE_ID);
  }

  public override parseDocument(document: TextDocument): GxWorkflowTestsDocument {
    const yamlDocument = this.yamlLanguageService.parseYAMLDocument(document);
    return new GxWorkflowTestsDocument(document, yamlDocument, this.server?.workflowDataProvider);
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
    return this.completionService.doComplete(documentContext, position);
  }

  protected override async doValidation(documentContext: WorkflowTestsDocument): Promise<Diagnostic[]> {
    return this.validationService.doValidation(documentContext);
  }
}
