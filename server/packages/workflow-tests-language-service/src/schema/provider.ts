import { injectable } from "inversify";
import WorkflowTestsSchema from "../../../../../workflow-languages/schemas/tests.schema.json";
import { JSONSchema } from "vscode-json-languageservice";

export interface WorkflowTestsSchemaProvider {
  getSchema(): JSONSchema;
}

@injectable()
export class WorkflowTestsSchemaProviderImpl implements WorkflowTestsSchemaProvider {
  public getSchema(): JSONSchema {
    return WorkflowTestsSchema;
  }
}
