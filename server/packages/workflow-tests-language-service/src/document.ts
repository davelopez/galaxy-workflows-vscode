import { TextDocument, WorkflowTestsDocument } from "@gxwf/server-common/src/languageTypes";
import { YAMLDocument } from "@gxwf/yaml-language-service/src";

/**
 * This class represents (YAML) document containing tests definitions for a Galaxy workflow.
 */
export class GxWorkflowTestsDocument extends WorkflowTestsDocument {
  private _yamlDocument: YAMLDocument;

  constructor(textDocument: TextDocument, yamlDocument: YAMLDocument) {
    super(textDocument, yamlDocument);
    this._yamlDocument = yamlDocument;
  }

  public get yamlDocument(): YAMLDocument {
    return this._yamlDocument;
  }
}
