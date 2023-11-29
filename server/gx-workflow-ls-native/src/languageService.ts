import {
  DocumentLanguageSettings,
  getLanguageService,
  JSONSchema,
  LanguageService as JSONLanguageService,
  LanguageServiceParams,
  LanguageSettings,
  SchemaConfiguration,
} from "vscode-json-languageservice";
import {
  CompletionList,
  Diagnostic,
  FormattingOptions,
  Hover,
  Position,
  Range,
  TextDocument,
  TextEdit,
  LanguageServiceBase,
  LanguageService,
} from "@gxwf/server-common/src/languageTypes";
import NativeWorkflowSchema from "../../../workflow-languages/schemas/native.schema.json";
import { NativeWorkflowDocument } from "./nativeWorkflowDocument";
import { injectable } from "inversify";

export interface NativeWorkflowLanguageService extends LanguageService<NativeWorkflowDocument> {}

/**
 * A wrapper around the JSON Language Service to support language features
 * for native Galaxy workflow files AKA '.ga' workflows.
 */
@injectable()
export class NativeWorkflowLanguageServiceImpl
  extends LanguageServiceBase<NativeWorkflowDocument>
  implements NativeWorkflowLanguageService
{
  private _jsonLanguageService: JSONLanguageService;
  private _documentSettings: DocumentLanguageSettings = { schemaValidation: "error" };

  constructor() {
    super("galaxyworkflow");
    const params: LanguageServiceParams = {};
    const settings = this.getLanguageSettings();
    this._jsonLanguageService = getLanguageService(params);
    this._jsonLanguageService.configure(settings);
  }

  public get schema(): JSONSchema {
    return NativeWorkflowSchema;
  }

  public override parseDocument(document: TextDocument): NativeWorkflowDocument {
    const jsonDocument = this._jsonLanguageService.parseJSONDocument(document);
    return new NativeWorkflowDocument(document, jsonDocument);
  }

  public override format(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[] {
    return this._jsonLanguageService.format(document, range, options);
  }

  public override async doHover(workflowDocument: NativeWorkflowDocument, position: Position): Promise<Hover | null> {
    const nativeWorkflowDocument = workflowDocument as NativeWorkflowDocument;
    const hover = await this._jsonLanguageService.doHover(
      nativeWorkflowDocument.textDocument,
      position,
      nativeWorkflowDocument.jsonDocument
    );
    return hover;
  }

  public override async doComplete(
    workflowDocument: NativeWorkflowDocument,
    position: Position
  ): Promise<CompletionList | null> {
    const nativeWorkflowDocument = workflowDocument as NativeWorkflowDocument;
    const completionResult = await this._jsonLanguageService.doComplete(
      nativeWorkflowDocument.textDocument,
      position,
      nativeWorkflowDocument.jsonDocument
    );
    return completionResult;
  }

  protected override async doValidation(workflowDocument: NativeWorkflowDocument): Promise<Diagnostic[]> {
    const nativeWorkflowDocument = workflowDocument as NativeWorkflowDocument;
    const schemaValidationResults = await this._jsonLanguageService.doValidation(
      nativeWorkflowDocument.textDocument,
      nativeWorkflowDocument.jsonDocument,
      this._documentSettings,
      this.schema
    );
    return schemaValidationResults;
  }

  private getLanguageSettings(): LanguageSettings {
    const settings: LanguageSettings = {
      schemas: [this.getWorkflowSchemaConfig()],
    };
    return settings;
  }

  private getWorkflowSchemaConfig(): SchemaConfiguration {
    return {
      uri: this.schema.id ?? "",
      fileMatch: ["**.ga"],
      schema: this.schema,
    };
  }
}
