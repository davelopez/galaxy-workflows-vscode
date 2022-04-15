import {
  getLanguageService,
  LanguageService,
  LanguageServiceParams,
  DocumentLanguageSettings,
  Diagnostic,
  JSONSchema,
  LanguageSettings,
  SchemaConfiguration,
} from "vscode-json-languageservice";
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
} from "./languageTypes";
import NativeWorkflowSchema from "../../workflow-languages/schemas/native.schema.json";

/**
 * A wrapper around the JSON Language Service to support language features
 * for native Galaxy workflow files AKA '.ga' workflows.
 */
export class NativeWorkflowLanguageService implements WorkflowLanguageService {
  private _jsonLanguageService: LanguageService;
  private _documentSettings: DocumentLanguageSettings = { schemaValidation: "error" };

  constructor() {
    const params: LanguageServiceParams = {};
    const settings = this.getLanguageSettings();
    this._jsonLanguageService = getLanguageService(params);
    this._jsonLanguageService.configure(settings);
  }

  public get schema(): JSONSchema {
    return NativeWorkflowSchema;
  }

  public parseWorkflowDocument(document: TextDocument): WorkflowDocument {
    const jsonDocument = this._jsonLanguageService.parseJSONDocument(document);
    return new WorkflowDocument(document, jsonDocument);
  }

  public format(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[] {
    return this._jsonLanguageService.format(document, range, options);
  }

  public async doValidation(workflowDocument: WorkflowDocument): Promise<Diagnostic[]> {
    const schemaValidationResults = await this._jsonLanguageService.doValidation(
      workflowDocument.textDocument,
      workflowDocument.jsonDocument,
      this._documentSettings,
      this.schema
    );
    return schemaValidationResults;
  }

  public async doHover(workflowDocument: WorkflowDocument, position: Position): Promise<Hover | null> {
    const hover = await this._jsonLanguageService.doHover(
      workflowDocument.textDocument,
      position,
      workflowDocument.jsonDocument
    );
    return hover;
  }

  public async doComplete(workflowDocument: WorkflowDocument, position: Position): Promise<CompletionList | null> {
    const completionResult = await this._jsonLanguageService.doComplete(
      workflowDocument.textDocument,
      position,
      workflowDocument.jsonDocument
    );
    return completionResult;
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
