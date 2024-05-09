import { TextDocument, WorkflowDocument } from "@gxwf/server-common/src/languageTypes";
import {
  GetWorkflowInputsResult,
  GetWorkflowOutputsResult,
} from "@gxwf/server-common/src/services/requestsDefinitions";
import { YAMLDocument } from "@gxwf/yaml-language-service/src";

/**
 * This class provides information about a gxformat2 workflow document structure.
 */
export class GxFormat2WorkflowDocument extends WorkflowDocument {
  private _yamlDocument: YAMLDocument;
  constructor(textDocument: TextDocument, yamlDocument: YAMLDocument) {
    super(textDocument, yamlDocument);
    this._yamlDocument = yamlDocument;
  }

  public get yamlDocument(): YAMLDocument {
    return this._yamlDocument;
  }

  public getWorkflowInputs(): GetWorkflowInputsResult {
    throw new Error("Method not implemented.");
  }
  public getWorkflowOutputs(): GetWorkflowOutputsResult {
    throw new Error("Method not implemented.");
  }
}
