import { ASTNode, ParsedDocument } from "@gxwf/server-common/src/ast/types";
import { TextDocument, WorkflowDocument } from "@gxwf/server-common/src/languageTypes";
import { JSONDocument } from "vscode-json-languageservice";

/**
 * This class provides information about a Native workflow document structure.
 */
export class NativeWorkflowDocument extends WorkflowDocument {
  private _jsonDocument: JSONDocument;

  constructor(textDocument: TextDocument, jsonDocument: JSONDocument) {
    const parsedDocument: ParsedDocument = {
      ...{
        root: jsonDocument.root as ASTNode,
        getNodeFromOffset(offset: number) {
          return jsonDocument.getNodeFromOffset(offset) as ASTNode | undefined;
        },
      },
      internalDocument: jsonDocument,
    };
    super(textDocument, parsedDocument);
    this._jsonDocument = jsonDocument;
  }

  public get jsonDocument(): JSONDocument {
    return this._jsonDocument;
  }
}
