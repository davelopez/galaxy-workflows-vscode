import { Diagnostic, DiagnosticSeverity, DocumentContext, Range } from "@gxwf/server-common/src/languageTypes";
import { inject, injectable } from "inversify";
import { ResolvedSchema } from "../schema/jsonSchema";
import { WorkflowTestsSchemaProvider } from "../schema/provider";
import { WorkflowTestsSchemaService } from "../schema/service";
import { TYPES } from "../types";

export interface WorkflowTestsValidationService {
  doValidation(documentContext: DocumentContext): Promise<Diagnostic[]>;
}

@injectable()
export class WorkflowTestsValidationServiceImpl implements WorkflowTestsValidationService {
  constructor(
    @inject(TYPES.WorkflowTestsSchemaProvider) protected schemaProvider: WorkflowTestsSchemaProvider,
    @inject(TYPES.WorkflowTestsSchemaService) protected schemaService: WorkflowTestsSchemaService
  ) {}

  async doValidation(documentContext: DocumentContext): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const added: { [signature: string]: boolean } = {};

    const addProblem = (problem: Diagnostic): void => {
      const signature = `${problem.range.start.line} ${problem.range.start.character} ${problem.message}`;
      if (!added[signature]) {
        added[signature] = true;
        diagnostics.push(problem);
      }
    };
    const getDiagnostics = (schema: ResolvedSchema | undefined): Diagnostic[] => {
      const severity = DiagnosticSeverity.Error;

      if (schema) {
        const addSchemaProblem = (errorMessage: string): void => {
          if (documentContext.nodeManager.root) {
            const astRoot = documentContext.nodeManager.root;
            const property = astRoot.type === "object" ? astRoot.properties[0] : undefined;
            if (property && property.keyNode.value === "$schema") {
              const node = property.valueNode || property;
              const range = Range.create(
                documentContext.textDocument.positionAt(node.offset),
                documentContext.textDocument.positionAt(node.offset + node.length)
              );
              addProblem(Diagnostic.create(range, errorMessage, severity));
            } else {
              const range = Range.create(
                documentContext.textDocument.positionAt(astRoot.offset),
                documentContext.textDocument.positionAt(astRoot.offset + 1)
              );
              addProblem(Diagnostic.create(range, errorMessage, severity));
            }
          }
        };

        if (schema.errors.length) {
          addSchemaProblem(schema.errors[0]);
        } else if (severity) {
          const semanticErrors = this.schemaService.validate(documentContext, severity);
          if (semanticErrors) {
            semanticErrors.forEach(addProblem);
          }
        }
      }

      return diagnostics;
    };

    const schema = this.schemaProvider.getResolvedSchema();
    const schemaValidation = getDiagnostics(schema);
    schemaValidation.forEach((diagnostic) => {
      diagnostic.source = "Workflow Tests Schema";
    });
    return schemaValidation;
  }
}
