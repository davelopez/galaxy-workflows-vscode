import { TextDocument, Range, Position, ASTNode } from "../languageTypes";
import { URI } from "vscode-uri";

/**
 * This class contains information about workflow semantics.
 */
export abstract class WorkflowDocument {
  protected _textDocument: TextDocument;
  protected _documentUri: URI;
  public abstract readonly rootNode: ASTNode | undefined;

  constructor(textDocument: TextDocument) {
    this._textDocument = textDocument;
    this._documentUri = URI.parse(this._textDocument.uri);
  }

  public get uri(): URI {
    return this._documentUri;
  }

  public get textDocument(): TextDocument {
    return this._textDocument;
  }

  public abstract getNodeAtPosition(position: Position): ASTNode | undefined;

  public abstract getDocumentRange(): Range;

  public getNodeRange(node: ASTNode): Range {
    return Range.create(
      this.textDocument.positionAt(node.offset),
      this.textDocument.positionAt(node.offset + node.length)
    );
  }

  public getNodeRangeAtPosition(position: Position): Range {
    const node = this.getNodeAtPosition(position);
    return node ? this.getNodeRange(node) : this.getDefaultRangeAtPosition(position);
  }

  public isLastNodeInParent(node: ASTNode): boolean {
    const parent = node.parent;
    if (!parent || !parent.children) {
      return true; // Must be root
    }
    const lastNode = parent.children[parent.children.length - 1];
    return node === lastNode;
  }

  public getPreviousSiblingNode(node: ASTNode): ASTNode | null {
    const parent = node.parent;
    if (!parent || !parent.children) {
      return null;
    }
    const previousNodeIndex = parent.children.indexOf(node) - 1;
    if (previousNodeIndex < 0) {
      return null;
    }
    return parent.children[previousNodeIndex];
  }

  protected getDefaultRangeAtPosition(position: Position): Range {
    const offset = this.textDocument.offsetAt(position);
    return Range.create(this.textDocument.positionAt(offset), this.textDocument.positionAt(offset + 1));
  }
}
