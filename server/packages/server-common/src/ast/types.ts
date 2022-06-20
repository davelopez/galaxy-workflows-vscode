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
}
