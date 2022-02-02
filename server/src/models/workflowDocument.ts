import { TextDocument } from "../languageTypes";

/**
 * This class contains information about workflow semantics.
 */
export class WorkflowDocument {
  private _textDocument: TextDocument;

  constructor(textDocument: TextDocument) {
    this._textDocument = textDocument;
  }

  public get documentUri(): string {
    return this._textDocument.uri;
  }

  public get textDocument(): TextDocument {
    return this._textDocument;
  }
}
