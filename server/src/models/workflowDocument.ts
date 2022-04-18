import { JSONDocument } from "vscode-json-languageservice";
import { TextDocument, Range, Position, ASTNode } from "../languageTypes";

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

  public getNodeAtPosition(position: Position): ASTNode | undefined {
    const offset = this.textDocument.offsetAt(position);
    return this.jsonDocument.getNodeFromOffset(offset);
  }

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

  private getDefaultRangeAtPosition(position: Position): Range {
    const offset = this.textDocument.offsetAt(position);
    return Range.create(this.textDocument.positionAt(offset), this.textDocument.positionAt(offset + 1));
  }
}
