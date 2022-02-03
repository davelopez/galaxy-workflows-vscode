import { JSONDocument } from "vscode-json-languageservice";
import { TextDocument } from "../languageTypes";

/**
 * This class contains information about workflow semantics.
 */
export class WorkflowDocument {
  private _textDocument: TextDocument;
  private _jsonDocument: JSONDocument;

  //TODO do not pass jsonDocument directly
  constructor(textDocument: TextDocument, jsonDocument: JSONDocument) {
    this._textDocument = textDocument;
    this._jsonDocument = jsonDocument;
  }

  public get documentUri(): string {
    return this._textDocument.uri;
  }

  public get textDocument(): TextDocument {
    return this._textDocument;
  }

  public get jsonDocument(): JSONDocument {
    return this._jsonDocument;
  }
}
