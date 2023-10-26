import { DocumentContext, TextDocument } from "../languageTypes";
import { URI } from "vscode-uri";
import { ParsedDocument } from "../ast/types";
import { ASTNodeManager } from "../ast/nodeManager";

/**
 * This class contains information about workflow semantics.
 */
export abstract class WorkflowDocument implements DocumentContext {
  protected _textDocument: TextDocument;
  protected _documentUri: URI;
  protected _parsedDocument: ParsedDocument;
  protected _nodeManager: ASTNodeManager;

  constructor(textDocument: TextDocument, parsedDocument: ParsedDocument) {
    this._textDocument = textDocument;
    this._parsedDocument = parsedDocument;
    this._nodeManager = new ASTNodeManager(textDocument, parsedDocument);
    this._documentUri = URI.parse(this._textDocument.uri);
  }

  public get uri(): URI {
    return this._documentUri;
  }

  public get textDocument(): TextDocument {
    return this._textDocument;
  }

  /** Abstract Syntax Tree Node Manager associated with this document. */
  public get nodeManager(): ASTNodeManager {
    return this._nodeManager;
  }
}
