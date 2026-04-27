import {
  CodeLens,
  CompletionList,
  Diagnostic,
  DiagramFormat,
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
import type { SymbolsProvider, ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import {
  cleanWorkflow,
  toNativeStateful,
  workflowToMermaid,
  type MermaidOptions,
  type ToolInputsResolver,
} from "@galaxy-tool-util/schema";
import * as YAML from "yaml";
import { TYPES as YAML_TYPES } from "@gxwf/yaml-language-service/src/inversify.config";
import type { YAMLLanguageService } from "@gxwf/yaml-language-service/src/yamlLanguageService";
import { inject, injectable } from "inversify";
import { GxFormat2WorkflowDocument } from "./gxFormat2WorkflowDocument";
import { GxFormat2BasicValidationProfile, GxFormat2IWCValidationProfile } from "./profiles";
import { JsonSchemaGalaxyWorkflowLoader } from "./schema/jsonSchemaLoader";
import { GxFormat2CompletionService } from "./services/completionService";
import { GxFormat2HoverService } from "./services/hoverService";
import { GxFormat2SchemaValidationService } from "./services/schemaValidationService";
import { ToolStateValidationService } from "./services/toolStateValidationService";

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
  private _schemaLoader: JsonSchemaGalaxyWorkflowLoader;
  private _hoverService: GxFormat2HoverService;
  private _completionService: GxFormat2CompletionService;
  private _schemaValidationService: GxFormat2SchemaValidationService;
  private _toolStateValidationService: ToolStateValidationService;

  constructor(
    @inject(YAML_TYPES.YAMLLanguageService) yamlLanguageService: YAMLLanguageService,
    @inject(TYPES.SymbolsProvider) private symbolsProvider: SymbolsProvider,
    @inject(TYPES.ToolRegistryService) private toolRegistryService: ToolRegistryService
  ) {
    super(LANGUAGE_ID);
    this._schemaLoader = new JsonSchemaGalaxyWorkflowLoader();
    this._yamlLanguageService = yamlLanguageService;
    this._hoverService = new GxFormat2HoverService(this._schemaLoader.nodeResolver, toolRegistryService);
    this._completionService = new GxFormat2CompletionService(this._schemaLoader.nodeResolver, toolRegistryService);
    this._schemaValidationService = new GxFormat2SchemaValidationService(this._schemaLoader.nodeResolver);
    this._toolStateValidationService = new ToolStateValidationService(toolRegistryService);
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

  public override async doCodeLens(documentContext: GxFormat2WorkflowDocument): Promise<CodeLens[]> {
    return buildToolIdCodeLenses(documentContext, this.toolRegistryService);
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
    const toolStateDiagnostics = await this._toolStateValidationService.doValidation(documentContext);
    toolStateDiagnostics.forEach((diagnostic) => {
      diagnostic.source = "Tool State";
    });
    return syntaxDiagnostics.concat(schemaDiagnostics, toolStateDiagnostics);
  }

  public override getSymbols(documentContext: GxFormat2WorkflowDocument): DocumentSymbol[] {
    return this.symbolsProvider.getSymbols(documentContext);
  }

  public override async cleanWorkflowText(text: string): Promise<string> {
    const dict = YAML.parse(text) as Record<string, unknown>;
    const toolInputsResolver = await this.buildToolInputsResolver(dict);
    const { workflow } = await cleanWorkflow(dict, { toolInputsResolver });
    return YAML.stringify(workflow, { lineWidth: 0 });
  }

  public override async convertWorkflowText(text: string, targetFormat: "format2" | "native"): Promise<string> {
    if (targetFormat !== "native") {
      throw new Error(`Format2 service only supports conversion to native; got '${targetFormat}'.`);
    }
    const dict = YAML.parse(text) as Record<string, unknown>;
    const toolInputsResolver = await this.buildToolInputsResolver(dict);
    const noopResolver: ToolInputsResolver = (_toolId: string, _toolVersion: string | null) => undefined;
    const { workflow } = toNativeStateful(dict, toolInputsResolver ?? noopResolver);
    return JSON.stringify(workflow, null, 4) + "\n";
  }

  public override async renderDiagram(
    text: string,
    format: DiagramFormat,
    options?: Record<string, unknown>
  ): Promise<string> {
    const dict = YAML.parse(text) as Record<string, unknown>;
    switch (format) {
      case "mermaid":
        return workflowToMermaid(dict, (options as MermaidOptions) ?? {});
      case "cytoscape":
        throw new Error("Cytoscape rendering is not yet implemented.");
    }
  }

  /**
   * Pre-fetches tool inputs for all steps in the workflow dict and returns a
   * synchronous resolver suitable for cleanWorkflow(). Returns undefined when
   * no tools are cached (cleanWorkflow skips tool-aware cleaning gracefully).
   */
  private async buildToolInputsResolver(
    workflowDict: Record<string, unknown>
  ): Promise<ToolInputsResolver | undefined> {
    const steps = workflowDict.steps;
    if (!steps || typeof steps !== "object" || Array.isArray(steps)) return undefined;

    const stepsObj = steps as Record<string, unknown>;
    const prefetched = new Map<string, unknown[]>();

    for (const step of Object.values(stepsObj)) {
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
}
