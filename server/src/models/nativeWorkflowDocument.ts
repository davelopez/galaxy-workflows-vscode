import { JSONDocument } from "vscode-json-languageservice";
import { getPropertyNodeFromPath } from "../jsonUtils";
import { TextDocument, Range, Position, ASTNode, WorkflowDocument } from "../languageTypes";

/**
 * This class contains information about Native workflow semantics.
 */
export class NativeWorkflowDocument extends WorkflowDocument {
  private _jsonDocument: JSONDocument;

  constructor(textDocument: TextDocument, jsonDocument: JSONDocument) {
    super(textDocument);
    this._jsonDocument = jsonDocument;
  }

  public get jsonDocument(): JSONDocument {
    return this._jsonDocument;
  }

  public get rootNode(): ASTNode | undefined {
    return this._jsonDocument.root;
  }

  public override getNodeAtPosition(position: Position): ASTNode | undefined {
    const offset = this.textDocument.offsetAt(position);
    return this.jsonDocument.getNodeFromOffset(offset);
  }

  public override getDocumentRange(): Range {
    const root = this.jsonDocument.root;
    if (root) {
      return Range.create(this.textDocument.positionAt(root.offset), this.textDocument.positionAt(root.length));
    }
    return Range.create(this.textDocument.positionAt(0), this.textDocument.positionAt(1));
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

  public override getNodeFromPath(path: string): ASTNode | null {
    const root = this._jsonDocument.root;
    if (!root) return null;
    return getPropertyNodeFromPath(root, path);
  }
}
