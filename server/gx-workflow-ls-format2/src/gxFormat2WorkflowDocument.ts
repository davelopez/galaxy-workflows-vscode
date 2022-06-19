import { ObjectASTNode } from "vscode-json-languageservice";
import { TextDocument, Range, Position, ASTNode, WorkflowDocument } from "@gxwf/server-common/src/languageTypes";
import { YAMLDocument } from "@gxwf/yaml-language-service/src";

/**
 * This class provides information about a gxformat2 workflow document structure.
 */
export class GxFormat2WorkflowDocument extends WorkflowDocument {
  private _yamlDocument: YAMLDocument;
  constructor(textDocument: TextDocument, yamlDocument: YAMLDocument) {
    super(textDocument);
    this._yamlDocument = yamlDocument;
  }

  public get rootNode(): ASTNode | undefined {
    return this._yamlDocument.mainDocument?.root;
  }

  public get yamlDocument(): YAMLDocument {
    return this._yamlDocument;
  }

  public override getNodeAtPosition(position: Position): ASTNode | undefined {
    return;
  }

  public override getDocumentRange(): Range {
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
    return null;
  }

  public override getStepNodes(): ObjectASTNode[] {
    return [];
  }
}
