export type ASTNode =
  | ObjectASTNode
  | PropertyASTNode
  | ArrayASTNode
  | StringASTNode
  | NumberASTNode
  | BooleanASTNode
  | NullASTNode;

export type ValueTypes = string | boolean | number | null;

export interface BaseASTNode {
  readonly type: "object" | "array" | "property" | "string" | "number" | "boolean" | "null";
  readonly parent?: ASTNode;
  readonly offset: number;
  readonly length: number;
  readonly children?: ASTNode[];
  readonly value?: ValueTypes;
  readonly internalNode: unknown;
  getNodeFromOffsetEndInclusive(offset: number): ASTNode | undefined;
}
export interface ObjectASTNode extends BaseASTNode {
  readonly type: "object";
  readonly properties: PropertyASTNode[];
  readonly children: ASTNode[];
}
export interface PropertyASTNode extends BaseASTNode {
  readonly type: "property";
  readonly keyNode: StringASTNode;
  readonly valueNode?: ASTNode;
  readonly colonOffset?: number;
  readonly children: ASTNode[];
}
export interface ArrayASTNode extends BaseASTNode {
  readonly type: "array";
  readonly items: ASTNode[];
  readonly children: ASTNode[];
}
export interface StringASTNode extends BaseASTNode {
  readonly type: "string";
  readonly value: string;
}
export interface NumberASTNode extends BaseASTNode {
  readonly type: "number";
  readonly value: number;
  readonly isInteger: boolean;
}
export interface BooleanASTNode extends BaseASTNode {
  readonly type: "boolean";
  readonly value: boolean;
}
export interface NullASTNode extends BaseASTNode {
  readonly type: "null";
  readonly value: null;
}

export interface ParsedDocument {
  root?: ASTNode;
  getNodeFromOffset(offset: number): ASTNode | undefined;
  /** Exposed for compatibility with existing external logic. */
  internalDocument: unknown;
}

/**
 * A NodePath segment. Either a string representing an object property name
 * or a number (starting at 0) for array indices.
 */
export type Segment = string | number;

/** Represents the full path to a node. */
export type NodePath = Segment[];
