import { Position, Range, TextDocument } from "../languageTypes";
import { ASTNode, NodePath, ObjectASTNode, ParsedDocument, PropertyASTNode, Segment } from "./types";
import { getPropertyNodeFromPath } from "./utils";

export class ASTNodeManager {
  constructor(
    private readonly textDocument: TextDocument,
    private readonly parsedDocument: ParsedDocument
  ) {}

  public get root(): ASTNode | undefined {
    return this.parsedDocument.root;
  }

  public getNodeFromOffset(offset: number): ASTNode | undefined {
    return this.parsedDocument.getNodeFromOffset(offset);
  }

  public getNodeAtPosition(position: Position): ASTNode | undefined {
    const offset = this.textDocument.offsetAt(position);
    return this.getNodeFromOffset(offset);
  }

  public getDocumentRange(): Range {
    if (this.root) {
      return Range.create(
        this.textDocument.positionAt(this.root.offset),
        this.textDocument.positionAt(this.root.length)
      );
    }
    return Range.create(this.textDocument.positionAt(0), this.textDocument.positionAt(1));
  }

  /** Returns a small Range at the beginning of the document */
  public getDefaultRange(): Range {
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

  public isRoot(node: ASTNode): boolean {
    return node.parent === undefined;
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

  public getChildren(node: ASTNode): ASTNode[] {
    return node.children ?? [];
  }

  public getDeclaredPropertyNames(node?: ASTNode): Set<string> {
    const result = new Set<string>();
    if (!node) {
      return result;
    }
    const declaredNodes = this.getChildren(node);
    declaredNodes.forEach((node) => {
      if (node.type === "property") {
        const key = node.keyNode.value;
        result.add(key);
      }
      if (node.type === "object") {
        node.properties.forEach((p) => {
          result.add(p.keyNode.value);
        });
      }
    });
    return result;
  }

  public getNodeFromPath(path: string): ASTNode | null {
    const root = this.root;
    if (!root) return null;
    return getPropertyNodeFromPath(root, path);
  }

  public getAllPropertyNodesByName(name: string): PropertyASTNode[] {
    const result: PropertyASTNode[] = [];
    const root = this.root;
    if (!root) return result;

    this.visit((node) => {
      if (node.type === "property" && node.keyNode.value === name && node.valueNode?.type === "object") {
        result.push(node);
      }
      return true;
    });
    return result;
  }

  public getPathFromNode(node?: ASTNode): NodePath {
    const path: NodePath = [];
    let current = node;
    while (current) {
      const segment = this.getNodeSegment(current);
      if (segment) {
        path.push(segment);
      }
      current = current.parent;
    }
    return path.reverse();
  }

  private getNodeSegment(node: ASTNode): Segment | undefined {
    if (node.type === "property") {
      const name = node.keyNode.value as string;
      return name;
    }
    if (node.parent?.type === "array") {
      const index = node.parent.children.indexOf(node);
      if (index !== -1) {
        return index;
      }
    }
  }

  public getStepNodes(includeSubworkflows = false): ObjectASTNode[] {
    const root = this.root;
    if (!root) {
      return [];
    }
    const result: ObjectASTNode[] = [];
    let stepsPropertyNodes: PropertyASTNode[] = [];
    if (includeSubworkflows) {
      stepsPropertyNodes = this.getAllPropertyNodesByName("steps");
    } else {
      const mainStepsProperty = this.getNodeFromPath("steps") as PropertyASTNode;
      stepsPropertyNodes = mainStepsProperty ? [mainStepsProperty] : [];
    }
    for (const stepsNode of stepsPropertyNodes) {
      if (stepsNode && stepsNode.valueNode && stepsNode.valueNode.type === "object") {
        stepsNode.valueNode.properties.forEach((stepProperty) => {
          const stepNode = stepProperty.valueNode;
          if (stepNode && stepNode.type === "object") {
            result.push(stepNode);
          }
        });
      }
    }

    return result;
  }

  protected getDefaultRangeAtPosition(position: Position): Range {
    const offset = this.textDocument.offsetAt(position);
    return Range.create(this.textDocument.positionAt(offset), this.textDocument.positionAt(offset + 1));
  }

  public visit(visitor: (node: ASTNode) => boolean): void {
    if (this.root) {
      const doVisit = (node: ASTNode): boolean => {
        let ctn = visitor(node);
        const children = node.children;
        if (Array.isArray(children)) {
          for (let i = 0; i < children.length && ctn; i++) {
            ctn = doVisit(children[i]);
          }
        }
        return ctn;
      };
      doVisit(this.root);
    }
  }
}
