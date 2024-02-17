import { TextDocument, WorkflowDocument } from "@gxwf/server-common/src/languageTypes";
import { JSONDocument } from "vscode-json-languageservice";

/**
 * This class provides information about a Native workflow document structure.
 */
export class NativeWorkflowDocument extends WorkflowDocument {
  private _jsonDocument: JSONDocument;

  constructor(textDocument: TextDocument, jsonDocument: JSONDocument) {
    super(textDocument, { ...jsonDocument, internalDocument: jsonDocument });
    this._jsonDocument = jsonDocument;
  }

  public get jsonDocument(): JSONDocument {
    return this._jsonDocument;
  }
}
