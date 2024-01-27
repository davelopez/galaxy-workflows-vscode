import { DocumentContext } from "@gxwf/server-common/src/languageTypes";
import { inject, injectable } from "inversify";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { TYPES } from "../types";
import { IApplicableSchema, JSONSchemaService } from "./adapter";
import { ResolvedSchema } from "./jsonSchema";
import { WorkflowTestsSchemaProvider } from "./provider";

export interface WorkflowTestsSchemaService {
  schema: ResolvedSchema;
  validate(documentContext: DocumentContext, severity?: DiagnosticSeverity): Diagnostic[] | undefined;
  getMatchingSchemas(documentContext: DocumentContext, nodeOffset?: number | undefined): IApplicableSchema[];
}

@injectable()
export class WorkflowTestsSchemaServiceImpl implements WorkflowTestsSchemaService {
  constructor(
    @inject(TYPES.WorkflowTestsSchemaProvider) protected schemaProvider: WorkflowTestsSchemaProvider,
    @inject(TYPES.JSONSchemaService) protected jsonSchemaService: JSONSchemaService
  ) {}

  get schema(): ResolvedSchema {
    return this.schemaProvider.getResolvedSchema();
  }

  validate(documentContext: DocumentContext, severity?: DiagnosticSeverity): Diagnostic[] | undefined {
    const resolvedSchema = this.schemaProvider.getResolvedSchema();
    return this.jsonSchemaService.validate(documentContext, resolvedSchema.schema, severity);
  }

  getMatchingSchemas(documentContext: DocumentContext, nodeOffset?: number | undefined): IApplicableSchema[] {
    const resolvedSchema = this.schemaProvider.getResolvedSchema();
    return this.jsonSchemaService.getMatchingSchemas(documentContext, resolvedSchema.schema, nodeOffset);
  }
}
