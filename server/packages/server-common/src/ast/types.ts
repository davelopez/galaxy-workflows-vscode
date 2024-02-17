import {
  ArrayASTNode,
  ASTNode,
  BaseASTNode,
  BooleanASTNode,
  NullASTNode,
  NumberASTNode,
  ObjectASTNode,
  PropertyASTNode,
  StringASTNode,
} from "vscode-json-languageservice";

export {
  ArrayASTNode,
  ASTNode,
  BaseASTNode,
  BooleanASTNode,
  NullASTNode,
  NumberASTNode,
  ObjectASTNode,
  PropertyASTNode,
  StringASTNode,
};

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
