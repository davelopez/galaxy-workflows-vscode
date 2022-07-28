import { ParsedDocument } from "@gxwf/server-common/src/ast/types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic, DiagnosticSeverity, Position } from "vscode-languageserver-types";
import { Document, Node, visit, YAMLError, YAMLWarning } from "yaml";
import { TextBuffer } from "../utils/textBuffer";
import { ASTNode, ObjectASTNodeImpl } from "./astTypes";

const FULL_LINE_ERROR = true;
const YAML_SOURCE = "YAML";
const YAML_COMMENT_SYMBOL = "#";

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
  private _configuredIndentation = 2; // TODO read this value from config

  constructor(public readonly subDocuments: YAMLSubDocument[], public readonly textDocument: TextDocument) {
    this._textBuffer = new TextBuffer(textDocument);
    this._diagnostics = undefined;
  }

  public get root(): ASTNode | undefined {
    return this.mainDocument?.root;
  }

  /** The first or single sub-document parsed. */
  public get mainDocument(): YAMLSubDocument | undefined {
    return this.subDocuments.at(0);
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
    const indentation = this._textBuffer.getLineIndentationAtOffset(offset);
    let result = rootNode.getNodeFromOffsetEndInclusive(offset);
    if (!result || (result === rootNode && indentation != 0)) {
      result = this.findParentNodeByIndentation(offset, indentation);
    }
    return result;
  }

  private findParentNodeByIndentation(offset: number, indentation: number): ASTNode | undefined {
    if (indentation == 0) {
      return this.root;
    }
    const parentIndentation = indentation - this._configuredIndentation;
    const parentLine = this._textBuffer.getPreviousLineNumberWithIndentation(offset, parentIndentation);
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

  constructor(public readonly root: ASTNode | undefined, private readonly parsedDocument: Document) {}

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
}
