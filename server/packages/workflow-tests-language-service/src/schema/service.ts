import { inject, injectable } from "inversify";
import { IApplicableSchema, JSONSchemaService } from "./adapter";
import { WorkflowTestsSchemaProvider } from "./provider";
import { TYPES } from "../types";
import { DocumentContext } from "@gxwf/server-common/src/languageTypes";
import { DiagnosticSeverity, Diagnostic } from "vscode-languageserver-types";

export interface WorkflowTestsSchemaService {
  validate(documentContext: DocumentContext, severity?: DiagnosticSeverity): Diagnostic[] | undefined;
  getMatchingSchemas(documentContext: DocumentContext, nodeOffset?: number | undefined): IApplicableSchema[];
}

@injectable()
export class WorkflowTestsSchemaServiceImpl implements WorkflowTestsSchemaService {
  constructor(
    @inject(TYPES.WorkflowTestsSchemaProvider) protected schemaProvider: WorkflowTestsSchemaProvider,
    @inject(TYPES.JSONSchemaService) protected jsonSchemaService: JSONSchemaService
  ) {}
  validate(documentContext: DocumentContext, severity?: DiagnosticSeverity): Diagnostic[] | undefined {
    const resolvedSchema = this.schemaProvider.getResolvedSchema();
    return this.jsonSchemaService.validate(documentContext, resolvedSchema.schema, severity);
  }
  getMatchingSchemas(documentContext: DocumentContext, nodeOffset?: number | undefined): IApplicableSchema[] {
    const resolvedSchema = this.schemaProvider.getResolvedSchema();
    return this.jsonSchemaService.getMatchingSchemas(documentContext, resolvedSchema.schema, nodeOffset);
  }
}
