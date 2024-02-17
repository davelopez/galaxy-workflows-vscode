import { URI } from "vscode-uri";
import { ASTNodeManager } from "../ast/nodeManager";
import { ParsedDocument } from "../ast/types";
import { DocumentContext, TextDocument } from "../languageTypes";

/**
 * This class contains basic common handling logic for any kind of known document.
 */
export abstract class DocumentBase implements DocumentContext {
  public readonly uri: URI;
  public readonly nodeManager: ASTNodeManager;

  constructor(
    public readonly textDocument: TextDocument,
    protected readonly parsedDocument: ParsedDocument
  ) {
    this.nodeManager = new ASTNodeManager(textDocument, parsedDocument);
    this.uri = URI.parse(textDocument.uri);
  }

  public get languageId(): string {
    return this.textDocument.languageId;
  }

  public get internalDocument(): unknown {
    return this.parsedDocument.internalDocument;
  }
}
