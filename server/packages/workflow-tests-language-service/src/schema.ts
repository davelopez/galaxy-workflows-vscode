import { injectable } from "inversify";
import WorkflowTestsSchema from "../../../../workflow-languages/schemas/tests.schema.json";
import { JSONSchema } from "vscode-json-languageservice";

export interface WorkflowTestsSchemaProvider {
  getSchema(): Promise<JSONSchema>;
}

@injectable()
export class WorkflowTestsSchemaProviderImpl implements WorkflowTestsSchemaProvider {
  public async getSchema(): Promise<JSONSchema> {
    return WorkflowTestsSchema;
  }
}
