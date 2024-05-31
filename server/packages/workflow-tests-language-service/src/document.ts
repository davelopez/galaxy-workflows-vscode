import { TextDocument, WorkflowDataProvider, WorkflowTestsDocument } from "@gxwf/server-common/src/languageTypes";
import { YAMLDocument } from "@gxwf/yaml-language-service/src";

/**
 * This class represents (YAML) document containing tests definitions for a Galaxy workflow.
 */
export class GxWorkflowTestsDocument extends WorkflowTestsDocument {
  protected readonly workflowDataProvider?: WorkflowDataProvider;

  constructor(
    textDocument: TextDocument,
    public readonly yamlDocument: YAMLDocument,
    workflowDataProvider?: WorkflowDataProvider
  ) {
    super(textDocument, yamlDocument);
    this.workflowDataProvider = workflowDataProvider;
  }
}
