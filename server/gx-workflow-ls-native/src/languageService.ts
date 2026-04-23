import {
  CodeLens,
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
import { buildToolIdCodeLenses } from "@gxwf/server-common/src/providers/toolIdCodeLens";
import { cleanWorkflow, toFormat2Stateful, type ToolInputsResolver } from "@galaxy-tool-util/schema";
import type { SymbolsProvider, ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import * as YAML from "yaml";
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
import { NativeToolStateValidationService } from "./services/nativeToolStateValidationService";
import { NativeHoverService } from "./services/nativeHoverService";
import { NativeToolStateCompletionService } from "./services/nativeToolStateCompletionService";
import { NativeWorkflowConnectionService } from "./services/nativeWorkflowConnectionService";

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
  private _toolStateValidationService: NativeToolStateValidationService;
  private _hoverService: NativeHoverService;
  private _toolStateCompletionService: NativeToolStateCompletionService;
  private _connectionService: NativeWorkflowConnectionService;

  constructor(
    @inject(TYPES.SymbolsProvider) private symbolsProvider: SymbolsProvider,
    @inject(TYPES.ToolRegistryService) private toolRegistryService: ToolRegistryService
  ) {
    super(LANGUAGE_ID);
    const params: LanguageServiceParams = {};
    const settings = this.getLanguageSettings();
    this._jsonLanguageService = getLanguageService(params);
    this._jsonLanguageService.configure(settings);
    this._toolStateValidationService = new NativeToolStateValidationService(this.toolRegistryService);
    this._hoverService = new NativeHoverService(this.toolRegistryService, this._jsonLanguageService);
    this._toolStateCompletionService = new NativeToolStateCompletionService(this.toolRegistryService);
    this._connectionService = new NativeWorkflowConnectionService(this.toolRegistryService);
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
    return this._hoverService.doHover(workflowDocument, position);
  }

  public override async doCodeLens(workflowDocument: NativeWorkflowDocument): Promise<CodeLens[]> {
    return buildToolIdCodeLenses(workflowDocument, this.toolRegistryService);
  }

  public override async doComplete(
    workflowDocument: NativeWorkflowDocument,
    position: Position
  ): Promise<CompletionList | null> {
    // Try tool_state parameter completions first
    const toolStateResult = await this._toolStateCompletionService.doCompleteAt(workflowDocument, position);
    if (toolStateResult) return toolStateResult;

    // Try input_connections completions
    const connResult = await this._connectionService.doCompleteAt(workflowDocument, position);
    if (connResult) return connResult;

    // Fallback: JSON schema completions
    return this._jsonLanguageService.doComplete(workflowDocument.textDocument, position, workflowDocument.jsonDocument);
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

    const toolStateDiagnostics = await this._toolStateValidationService.doValidation(nativeWorkflowDocument);
    toolStateDiagnostics.forEach((diagnostic) => {
      diagnostic.source = "Tool State";
    });

    return [...schemaValidationResults, ...toolStateDiagnostics];
  }

  public override getSymbols(documentContext: NativeWorkflowDocument): DocumentSymbol[] {
    return this.symbolsProvider.getSymbols(documentContext);
  }

  public override async cleanWorkflowText(text: string): Promise<string> {
    const dict = JSON.parse(text) as Record<string, unknown>;
    const toolInputsResolver = await this.buildToolInputsResolver(dict);
    const { workflow } = await cleanWorkflow(dict, { toolInputsResolver });
    return JSON.stringify(workflow, null, 4) + "\n";
  }

  public override async convertWorkflowText(text: string, targetFormat: "format2" | "native"): Promise<string> {
    if (targetFormat !== "format2") {
      throw new Error(`Native service only supports conversion to format2; got '${targetFormat}'.`);
    }
    const dict = JSON.parse(text) as Record<string, unknown>;
    const toolInputsResolver = await this.buildToolInputsResolver(dict);
    const noopResolver: ToolInputsResolver = (_toolId: string, _toolVersion: string | null) => undefined;
    const { workflow } = toFormat2Stateful(dict, toolInputsResolver ?? noopResolver);
    return YAML.stringify(workflow, { lineWidth: 0 });
  }

  private async buildToolInputsResolver(
    workflowDict: Record<string, unknown>
  ): Promise<ToolInputsResolver | undefined> {
    const steps = workflowDict.steps;
    // Native .ga steps can be an object keyed by step index or an array
    const stepValues = Array.isArray(steps)
      ? steps
      : steps && typeof steps === "object"
      ? Object.values(steps as Record<string, unknown>)
      : [];

    const prefetched = new Map<string, unknown[]>();

    for (const step of stepValues) {
      if (!step || typeof step !== "object" || Array.isArray(step)) continue;
      const stepObj = step as Record<string, unknown>;
      const toolId = typeof stepObj.tool_id === "string" ? stepObj.tool_id : null;
      const toolVersion = typeof stepObj.tool_version === "string" ? stepObj.tool_version : null;
      if (!toolId) continue;
      const params = await this.toolRegistryService.getToolParameters(toolId, toolVersion ?? undefined);
      if (params) {
        prefetched.set(`${toolId}|${toolVersion ?? ""}`, params);
      }
    }

    if (prefetched.size === 0) return undefined;
    return (toolId, toolVersion) => prefetched.get(`${toolId}|${toolVersion ?? ""}`) as ReturnType<ToolInputsResolver>;
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
