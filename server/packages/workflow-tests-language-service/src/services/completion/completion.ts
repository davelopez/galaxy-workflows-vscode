import { CompletionList, DocumentContext, Position } from "@gxwf/server-common/src/languageTypes";
import { inject, injectable } from "inversify";
import { WorkflowTestsSchemaService } from "../../schema/service";
import { TYPES } from "../../types";
import { YAMLCompletionHelper } from "./helper";

export interface WorkflowTestsCompletionService {
  doComplete(documentContext: DocumentContext, position: Position): Promise<CompletionList | null>;
}

/**
 * Simple wrapper around the YAMLCompletionHelper to combine it with custom completion logic.
 */
@injectable()
export class WorkflowTestsCompletionServiceImpl implements WorkflowTestsCompletionService {
  private yamlCompletionHelper: YAMLCompletionHelper;

  constructor(@inject(TYPES.WorkflowTestsSchemaService) protected schemaService: WorkflowTestsSchemaService) {
    this.yamlCompletionHelper = new YAMLCompletionHelper(schemaService);
  }

  public async doComplete(documentContext: DocumentContext, position: Position): Promise<CompletionList | null> {
    // TODO: Add custom completion logic specific to workflow test files here
    const result = await this.yamlCompletionHelper.doComplete(documentContext, position);
    return result;
  }
}
