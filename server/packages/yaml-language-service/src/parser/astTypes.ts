import {
  BaseASTNode,
  ArrayASTNode,
  ASTNode,
  BooleanASTNode,
  NullASTNode,
  NumberASTNode,
  ObjectASTNode,
  PropertyASTNode,
  StringASTNode,
} from "@gxwf/server-common/src/ast/types";
import { Node, Pair } from "yaml";

export {
  ArrayASTNode,
  ASTNode,
  BooleanASTNode,
  NullASTNode,
  NumberASTNode,
  ObjectASTNode,
  PropertyASTNode,
  StringASTNode,
};

export type YamlNode = Node | Pair;

export abstract class ASTNodeImpl {
  public abstract readonly type: "object" | "property" | "array" | "number" | "boolean" | "null" | "string";

  public offset: number;
  public length: number;
  public readonly parent: ASTNode | undefined;
  readonly internalNode: YamlNode;

  constructor(parent: ASTNode | undefined, internalNode: YamlNode, offset: number, length: number) {
    this.offset = offset;
    this.length = length;
    this.parent = parent;
    this.internalNode = internalNode;
  }

  public getNodeFromOffsetEndInclusive(offset: number): ASTNode | undefined {
    const collector: BaseASTNode[] = [];
    const findNode = (node: BaseASTNode): BaseASTNode | undefined => {
      if (offset >= node.offset && offset <= node.offset + node.length) {
        const children = node.children;
        if (children && children.length) {
          for (let i = 0; i < children.length && children[i].offset <= offset; i++) {
            const item = findNode(children[i]);
            if (item) {
              collector.push(item);
            }
          }
          return node;
        }
      }
      return undefined;
    };
    const foundNode = findNode(this);
    let currMinDist = Number.MAX_VALUE;
    let currMinNode = null;
    for (const currNode of collector) {
      const minDist = currNode.length + currNode.offset - offset + (offset - currNode.offset);
      if (minDist < currMinDist) {
        currMinNode = currNode;
        currMinDist = minDist;
      }
    }
    return (currMinNode || foundNode) as ASTNode | undefined;
  }

  public get children(): ASTNode[] {
    return [];
  }

  public toString(): string {
    return (
      "type: " +
      this.type +
      " (" +
      this.offset +
      "/" +
      this.length +
      ")" +
      (this.parent ? " parent: {" + this.parent.toString() + "}" : "")
    );
  }
}

export class NullASTNodeImpl extends ASTNodeImpl implements NullASTNode {
  public type: "null" = "null";
  public value = null;
  constructor(parent: ASTNode | undefined, internalNode: Node, offset: number, length: number) {
    super(parent, internalNode, offset, length);
  }
}

export class BooleanASTNodeImpl extends ASTNodeImpl implements BooleanASTNode {
  public type: "boolean" = "boolean";
  public value: boolean;

  constructor(parent: ASTNode | undefined, internalNode: Node, boolValue: boolean, offset: number, length: number) {
    super(parent, internalNode, offset, length);
    this.value = boolValue;
  }
}

export class ArrayASTNodeImpl extends ASTNodeImpl implements ArrayASTNode {
  public type: "array" = "array";
  public items: ASTNode[];

  constructor(parent: ASTNode | undefined, internalNode: Node, offset: number, length: number) {
    super(parent, internalNode, offset, length);
    this.items = [];
  }

  public get children(): ASTNode[] {
    return this.items;
  }
}

export class NumberASTNodeImpl extends ASTNodeImpl implements NumberASTNode {
  public type: "number" = "number";
  public isInteger: boolean;
  public value: number;

  constructor(parent: ASTNode | undefined, internalNode: Node, offset: number, length: number) {
    super(parent, internalNode, offset, length);
    this.isInteger = true;
    this.value = Number.NaN;
  }
}

export class StringASTNodeImpl extends ASTNodeImpl implements StringASTNode {
  public type: "string" = "string";
  public value: string;

  constructor(parent: ASTNode | undefined, internalNode: Node, offset: number, length: number) {
    super(parent, internalNode, offset, length);
    this.value = "";
  }
}

export class PropertyASTNodeImpl extends ASTNodeImpl implements PropertyASTNode {
  public type: "property" = "property";
  public keyNode: StringASTNode;
  public valueNode?: ASTNode;
  public colonOffset: number;

  constructor(parent: ObjectASTNode, keyNode: StringASTNode, internalNode: Pair, offset: number, length: number) {
    super(parent, internalNode, offset, length);
    this.colonOffset = -1;
    this.keyNode = keyNode;
  }

  public get children(): ASTNode[] {
    return this.valueNode ? [this.keyNode, this.valueNode] : [this.keyNode];
  }
}

export class ObjectASTNodeImpl extends ASTNodeImpl implements ObjectASTNode {
  public type: "object" = "object";
  public properties: PropertyASTNode[];

  constructor(parent: ASTNode | undefined, internalNode: Node, offset: number, length: number) {
    super(parent, internalNode, offset, length);

    this.properties = [];
  }

  public get children(): ASTNode[] {
    return this.properties;
  }
}
