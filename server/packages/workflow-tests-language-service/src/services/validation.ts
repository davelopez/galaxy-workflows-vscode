import {
  Diagnostic,
  DiagnosticSeverity,
  DocumentContext,
  Range,
  WorkflowTestsDocument,
} from "@gxwf/server-common/src/languageTypes";
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
    const semanticValidation = await this.doSemanticValidation(documentContext);
    return schemaValidation.concat(semanticValidation);
  }

  // TODO: convert to rules
  async doSemanticValidation(documentContext: DocumentContext): Promise<Diagnostic[]> {
    const testDocument = documentContext as WorkflowTestsDocument;
    const inputDiagnostics = await this.validateWorkflowInputs(testDocument);
    const outputDiagnostics = await this.validateWorkflowOutputs(testDocument);
    return inputDiagnostics.concat(outputDiagnostics);
  }

  private async validateWorkflowInputs(testDocument: WorkflowTestsDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const workflowInputs = await testDocument.getWorkflowInputs();
    const documentInputNodes = testDocument.nodeManager.getAllPropertyNodesByName("job")[0]?.valueNode?.children ?? [];
    documentInputNodes.forEach((inputNode) => {
      if (inputNode.type !== "property") {
        return;
      }
      const inputName = inputNode.keyNode.value as string;
      const input = workflowInputs.find((i) => i.name === inputName);
      if (!input) {
        const range = Range.create(
          testDocument.textDocument.positionAt(inputNode.offset),
          testDocument.textDocument.positionAt(inputNode.offset + inputNode.length)
        );
        const message = `Input "${inputName}" is not defined in the associated workflow.`;
        diagnostics.push(Diagnostic.create(range, message, DiagnosticSeverity.Error));
      }
    });
    return diagnostics;
  }

  private async validateWorkflowOutputs(testDocument: WorkflowTestsDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const workflowOutputs = await testDocument.getWorkflowOutputs();
    const documentOutputNodes =
      testDocument.nodeManager.getAllPropertyNodesByName("outputs")[0]?.valueNode?.children ?? [];
    documentOutputNodes.forEach((outputNode) => {
      if (outputNode.type !== "property") {
        return;
      }
      const outputName = outputNode.keyNode.value as string;
      const output = workflowOutputs.find((o) => o.name === outputName);
      if (!output) {
        const range = Range.create(
          testDocument.textDocument.positionAt(outputNode.offset),
          testDocument.textDocument.positionAt(outputNode.offset + outputNode.length)
        );
        const message = `Output "${outputName}" is not defined in the associated workflow.`;
        diagnostics.push(Diagnostic.create(range, message, DiagnosticSeverity.Error));
      }
    });
    return diagnostics;
  }
}
