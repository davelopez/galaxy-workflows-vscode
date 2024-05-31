/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ParsedDocument } from "@gxwf/server-common/src/ast/types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic, DiagnosticSeverity, Position } from "vscode-languageserver-types";
import { Document, LineCounter, Node, Pair, YAMLError, YAMLWarning, isNode, isPair, isScalar, visit } from "yaml";
import { getIndentation, getParent } from "../utils";
import { guessIndentation } from "../utils/indentationGuesser";
import { TextBuffer } from "../utils/textBuffer";
import { convertAST } from "./astConverter";
import { ASTNode, ObjectASTNodeImpl, YamlNode } from "./astTypes";

const FULL_LINE_ERROR = true;
const YAML_SOURCE = "YAML";
const YAML_COMMENT_SYMBOL = "#";
const DEFAULT_INDENTATION = 2;

export class LineComment {
  constructor(public readonly text: string) {}
}

/**
 * Represents a YAML document.
 * YAML documents can contain multiple sub-documents separated by "---".
 */
export class YAMLDocument implements ParsedDocument {
  private readonly _textBuffer: TextBuffer;
  private _diagnostics: Diagnostic[] | undefined;
  private _indentation: number;

  constructor(
    public readonly subDocuments: YAMLSubDocument[],
    public readonly textDocument: TextDocument
  ) {
    this._textBuffer = new TextBuffer(textDocument);
    this._diagnostics = undefined;
    this._indentation = guessIndentation(this._textBuffer, DEFAULT_INDENTATION, true).tabSize;
  }

  public get root(): ASTNode | undefined {
    return this.mainDocument?.root;
  }

  /** The first or single sub-document parsed. */
  public get mainDocument(): YAMLSubDocument | undefined {
    return this.subDocuments.at(0);
  }

  /** Internal parsed document.
   * Exposed for compatibility with reused code from RedHat's YAML Language Service.
   */
  public get internalDocument(): YAMLSubDocument | undefined {
    return this.mainDocument;
  }

  /** Returns basic YAML syntax errors or warnings. */
  public get syntaxDiagnostics(): Diagnostic[] {
    if (!this._diagnostics) {
      this._diagnostics = this.getSyntaxDiagnostics();
    }
    return this._diagnostics;
  }

  /** List of comments in this document. */
  public get lineComments(): LineComment[] {
    return this.collectLineComments();
  }

  public isComment(offset: number): boolean {
    const position = this._textBuffer.getPosition(offset);
    const lineContent = this._textBuffer.getLineContent(position.line).trimStart();
    return lineContent.startsWith(YAML_COMMENT_SYMBOL);
  }

  /**
   * Gets the syntax node at this document offset.
   * @param offset The offset in the text document
   * @returns The syntax node that lies at the given offset
   */
  public getNodeFromOffset(offset: number): ASTNode | undefined {
    const rootNode = this.root as ObjectASTNodeImpl;
    if (!rootNode) return undefined;
    if (this.isComment(offset)) return undefined;
    const position = this._textBuffer.getPosition(offset);
    if (position.character === 0 && !this._textBuffer.hasTextAfterPosition(position)) return rootNode;
    const indentation = this._textBuffer.getLineIndentationAtOffset(offset);
    const lineContent = this._textBuffer.getLineContent(position.line);
    const contentAfterCursor = lineContent.slice(position.character).replace(/\s/g, "");
    if (indentation === 0 && contentAfterCursor.length === 0) return rootNode;
    let result = rootNode.getNodeFromOffsetEndInclusive(offset);
    const parent = this.findParentNodeByIndentation(offset, indentation);
    if (!result || (parent && result.offset < parent.offset && result.length > parent.length)) {
      result = parent;
    }
    return result;
  }

  private findParentNodeByIndentation(offset: number, indentation: number): ASTNode | undefined {
    if (indentation === 0) return this.root;
    const parentIndentation = Math.max(0, indentation - this._indentation);
    const parentLine = this._textBuffer.findPreviousLineWithSameIndentation(offset, parentIndentation);
    const parentOffset = this._textBuffer.getOffsetAt(Position.create(parentLine, parentIndentation));

    const rootNode = this.root as ObjectASTNodeImpl;
    if (!rootNode) return undefined;
    const parentNode = rootNode.getNodeFromOffsetEndInclusive(parentOffset);
    return parentNode;
  }

  /** Collects all syntax errors and warnings found on this document. */
  private getSyntaxDiagnostics(): Diagnostic[] {
    const syntaxErrors = this.subDocuments.flatMap((subDoc) =>
      subDoc.errors.map((e) => this.YAMLErrorToDiagnostics(e))
    );
    const syntaxWarnings = this.subDocuments.flatMap((subDoc) =>
      subDoc.warnings.map((e) => this.YAMLErrorToDiagnostics(e))
    );
    return syntaxErrors.concat(syntaxWarnings);
  }

  /** Converts from internal YAMLError to a document Diagnostic item. */
  private YAMLErrorToDiagnostics(error: YAMLError): Diagnostic {
    const begin = error.pos[0];
    const end = error.pos[1];
    const severity: DiagnosticSeverity =
      error instanceof YAMLWarning ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error;
    const start = this.textDocument.positionAt(begin);
    const range = {
      start,
      end: FULL_LINE_ERROR
        ? Position.create(start.line, this._textBuffer.getLineLength(start.line))
        : this.textDocument.positionAt(end),
    };
    return Diagnostic.create(range, error.message, severity, error.code, YAML_SOURCE);
  }

  /** Collects all comment lines across all sub-documents contained in this document. */
  private collectLineComments(): LineComment[] {
    const lineComments: LineComment[] = [];
    this.subDocuments.forEach((subDocument) => {
      lineComments.push(...subDocument.lineComments);
    });
    return lineComments;
  }
}

export class YAMLSubDocument {
  private _lineComments: LineComment[] | undefined;

  private _root: ASTNode | undefined;

  constructor(
    private readonly parsedDocument: Document,
    private readonly _lineCounter: LineCounter
  ) {}

  get root(): ASTNode | undefined {
    if (!this._root) {
      this.updateFromInternalDocument();
    }
    return this._root;
  }

  get internalDocument(): Document {
    return this.parsedDocument;
  }

  get errors(): YAMLError[] {
    return this.parsedDocument.errors;
  }

  get warnings(): YAMLWarning[] {
    return this.parsedDocument.warnings;
  }

  get lineComments(): LineComment[] {
    if (!this._lineComments) {
      this._lineComments = this.collectLineComments();
    }
    return this._lineComments;
  }

  public updateFromInternalDocument(): void {
    this._root = convertAST(undefined, this.parsedDocument.contents as Node, this.parsedDocument, this._lineCounter);
  }

  private collectLineComments(): LineComment[] {
    const lineComments = [];
    if (this.parsedDocument.commentBefore) {
      const comments = this.parsedDocument.commentBefore.split("\n");
      comments.forEach((comment) => lineComments.push(new LineComment(`${YAML_COMMENT_SYMBOL}${comment}`)));
    }
    visit(this.parsedDocument, (_key, docNode) => {
      const node = docNode as Node;
      if (node?.commentBefore) {
        const comments = node?.commentBefore.split("\n");
        comments.forEach((comment) => lineComments.push(new LineComment(`${YAML_COMMENT_SYMBOL}${comment}`)));
      }

      if (node?.comment) {
        lineComments.push(new LineComment(`${YAML_COMMENT_SYMBOL}${node.comment}`));
      }
    });

    if (this.parsedDocument.comment) {
      lineComments.push(new LineComment(`${YAML_COMMENT_SYMBOL}${this.parsedDocument.comment}`));
    }
    return lineComments;
  }

  /**
   * Create a deep copy of this document
   */
  clone(): YAMLSubDocument {
    const parsedDocumentCopy = this.parsedDocument.clone();
    const lineCounterCopy = new LineCounter();
    this._lineCounter.lineStarts.forEach((lineStart) => lineCounterCopy.addNewLine(lineStart));
    const copy = new YAMLSubDocument(parsedDocumentCopy, lineCounterCopy);
    return copy;
  }

  getNodeFromPosition(
    positionOffset: number,
    textBuffer: TextBuffer,
    configuredIndentation?: number
  ): [YamlNode | undefined, boolean] {
    const position = textBuffer.getPosition(positionOffset);
    const lineContent = textBuffer.getLineContent(position.line);
    if (lineContent.trim().length === 0) {
      return [this.findClosestNode(positionOffset, textBuffer, configuredIndentation), true];
    }

    const textAfterPosition = lineContent.substring(position.character);
    const spacesAfterPositionMatch = textAfterPosition.match(/^([ ]+)\n?$/);
    const areOnlySpacesAfterPosition = !!spacesAfterPositionMatch;
    const countOfSpacesAfterPosition = spacesAfterPositionMatch?.[1].length ?? 0;
    let closestNode: Node | undefined = undefined;
    visit(this.parsedDocument, (_, node) => {
      if (!node) {
        return;
      }
      const range = (node as Node).range;
      if (!range) {
        return;
      }

      const isNullNodeOnTheLine = (): boolean =>
        areOnlySpacesAfterPosition &&
        positionOffset + countOfSpacesAfterPosition === range[2] &&
        isScalar(node) &&
        node.value === null;

      if ((range[0] <= positionOffset && range[1] >= positionOffset) || isNullNodeOnTheLine()) {
        closestNode = node as Node;
      } else {
        return visit.SKIP;
      }
    });

    return [closestNode, false];
  }

  findClosestNode(offset: number, textBuffer: TextBuffer, configuredIndentation?: number): YamlNode | undefined {
    let offsetDiff = this.parsedDocument.range?.[2] ?? 0;
    let maxOffset = this.parsedDocument.range?.[0] ?? 0;
    let closestNode: YamlNode | undefined = undefined;
    visit(this.parsedDocument, (_key, node) => {
      if (!node) {
        return;
      }
      const range = (node as Node).range;
      if (!range) {
        return;
      }
      const diff = range[1] - offset;
      if (maxOffset <= range[0] && diff <= 0 && Math.abs(diff) <= offsetDiff) {
        offsetDiff = Math.abs(diff);
        maxOffset = range[0];
        closestNode = node as Node;
      }
    });

    const position = textBuffer.getPosition(offset);
    const lineContent = textBuffer.getLineContent(position.line);
    const indentation = getIndentation(lineContent, position.character);

    if (isScalar(closestNode) && (closestNode as Pair).value === null) {
      return closestNode;
    }

    if (indentation === position.character) {
      closestNode = this.getProperParentByIndentation(indentation, closestNode, textBuffer, "", configuredIndentation);
    }

    return closestNode;
  }

  private getProperParentByIndentation(
    indentation: number,
    node: YamlNode | undefined,
    textBuffer: TextBuffer,
    currentLine: string,
    configuredIndentation?: number,
    rootParent?: YamlNode
  ): YamlNode {
    if (!node) {
      return this.parsedDocument.contents as Node;
    }
    configuredIndentation = !configuredIndentation ? 2 : configuredIndentation;
    if (isNode(node) && node.range) {
      const position = textBuffer.getPosition(node.range[0]);
      const lineContent = textBuffer.getLineContent(position.line);
      currentLine = currentLine === "" ? lineContent.trim() : currentLine;
      if (currentLine.startsWith("-") && indentation === configuredIndentation && currentLine === lineContent.trim()) {
        position.character += indentation;
      }
      if (position.character > indentation && position.character > 0) {
        const parent = this.getParent(node);
        if (parent) {
          return this.getProperParentByIndentation(
            indentation,
            parent,
            textBuffer,
            currentLine,
            configuredIndentation,
            rootParent
          );
        }
      } else if (position.character < indentation) {
        const parent = this.getParent(node);
        if (isPair(parent) && isNode(parent.value)) {
          return parent.value;
        } else if (isPair(rootParent) && isNode(rootParent.value)) {
          return rootParent.value;
        }
      } else {
        return node;
      }
    } else if (isPair(node)) {
      rootParent = node;
      const parent = this.getParent(node);
      return this.getProperParentByIndentation(
        indentation,
        parent,
        textBuffer,
        currentLine,
        configuredIndentation,
        rootParent
      );
    }
    return node;
  }

  getParent(node: YamlNode): YamlNode | undefined {
    return getParent(this.parsedDocument, node);
  }
}
