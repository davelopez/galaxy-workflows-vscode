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
  TYPES,
  TextDocument,
  TextEdit,
} from "@gxwf/server-common/src/languageTypes";
import { cleanWorkflow } from "@galaxy-tool-util/schema";
import type { SymbolsProvider } from "@gxwf/server-common/src/languageTypes";
import { inject, injectable } from "inversify";
import {
  DocumentLanguageSettings,
  LanguageService as JSONLanguageService,
  JSONSchema,
  LanguageServiceParams,
  LanguageSettings,
  SchemaConfiguration,
  getLanguageService,
} from "vscode-json-languageservice";
import { NativeWorkflowDocument } from "./nativeWorkflowDocument";
import { NativeBasicValidationProfile, NativeIWCValidationProfile } from "./profiles";
import { JsonSchemaNativeWorkflowLoader } from "./schema/jsonSchemaLoader";

const LANGUAGE_ID = "galaxyworkflow";

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
  private _schemaLoader = new JsonSchemaNativeWorkflowLoader();

  constructor(@inject(TYPES.SymbolsProvider) private symbolsProvider: SymbolsProvider) {
    super(LANGUAGE_ID);
    const params: LanguageServiceParams = {};
    const settings = this.getLanguageSettings();
    this._jsonLanguageService = getLanguageService(params);
    this._jsonLanguageService.configure(settings);
  }

  public get schema(): JSONSchema {
    return this._schemaLoader.jsonSchema;
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

  protected override initializeValidationProfiles(): void {
    super.initializeValidationProfiles();
    this.validationProfiles.set("basic", new NativeBasicValidationProfile());
    this.validationProfiles.set("iwc", new NativeIWCValidationProfile());
  }

  protected override async doValidation(workflowDocument: NativeWorkflowDocument): Promise<Diagnostic[]> {
    const nativeWorkflowDocument = workflowDocument as NativeWorkflowDocument;
    const schemaValidationResults = await this._jsonLanguageService.doValidation(
      nativeWorkflowDocument.textDocument,
      nativeWorkflowDocument.jsonDocument,
      this._documentSettings,
      this.schema
    );
    schemaValidationResults.forEach((diagnostic) => {
      diagnostic.source = "Native Workflow Schema";
    });
    return schemaValidationResults;
  }

  public override getSymbols(documentContext: NativeWorkflowDocument): DocumentSymbol[] {
    return this.symbolsProvider.getSymbols(documentContext);
  }

  public override async cleanWorkflowText(text: string): Promise<string> {
    const dict = JSON.parse(text) as Record<string, unknown>;
    const { workflow } = await cleanWorkflow(dict);
    return JSON.stringify(workflow, null, 4) + "\n";
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
