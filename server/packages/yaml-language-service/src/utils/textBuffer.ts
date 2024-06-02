/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextDocument } from "vscode-languageserver-textdocument";
import { Position, Range } from "vscode-languageserver-types";
import { getIndentation } from ".";
import { CharCode } from "../parser/charCode";

interface FullTextDocument {
  getLineOffsets(): number[];
}

export interface ITextBuffer {
  getLineCount(): number;
  getLineLength(lineNumber: number): number;
  getLineCharCode(lineNumber: number, index: number): number;
  getLineContent(lineNumber: number): string;
}

export class TextBuffer {
  constructor(private doc: TextDocument) {}

  public getLineCount(): number {
    return this.doc.lineCount;
  }

  public getLineLength(lineNumber: number): number {
    const lineOffsets = (this.doc as unknown as FullTextDocument).getLineOffsets();
    if (lineNumber >= lineOffsets.length) {
      return this.doc.getText().length;
    } else if (lineNumber < 0) {
      return 0;
    }

    const nextLineOffset =
      lineNumber + 1 < lineOffsets.length ? lineOffsets[lineNumber + 1] : this.doc.getText().length;
    return nextLineOffset - lineOffsets[lineNumber];
  }

  public getLineContent(lineNumber: number): string {
    const lineOffsets = (this.doc as unknown as FullTextDocument).getLineOffsets();
    if (lineNumber >= lineOffsets.length) {
      return this.doc.getText();
    } else if (lineNumber < 0) {
      return "";
    }
    const nextLineOffset =
      lineNumber + 1 < lineOffsets.length ? lineOffsets[lineNumber + 1] : this.doc.getText().length;
    return this.doc.getText().substring(lineOffsets[lineNumber], nextLineOffset);
  }

  public getLineCharCode(lineNumber: number, index: number): number {
    return this.doc.getText(Range.create(lineNumber - 1, index - 1, lineNumber - 1, index)).charCodeAt(0);
  }

  public getText(range?: Range): string {
    return this.doc.getText(range);
  }

  public getPosition(offset: number): Position {
    return this.doc.positionAt(offset);
  }

  public getOffsetAt(position: Position): number {
    return this.doc.offsetAt(position);
  }

  public getCurrentWord(offset: number): string {
    let i = offset - 1;
    const text = this.getText();
    while (i >= 0 && ' \t\n\r\v":{[,]}'.indexOf(text.charAt(i)) === -1) {
      i--;
    }
    return text.substring(i + 1, offset);
  }

  public getCurrentWordRange(offset: number): Range {
    let i = offset - 1;
    const text = this.getText();
    while (i >= 0 && ' \t\n\r\v":{[,]}'.indexOf(text.charAt(i)) === -1) {
      i--;
    }
    return Range.create(this.getPosition(i + 1), this.getPosition(offset));
  }

  public hasTextAfterPosition(position: Position): boolean {
    const lineContent = this.getLineContent(position.line);
    return lineContent.charAt(position.character + 1).trim() !== "";
  }

  public getLineIndentationAtOffset(offset: number): number {
    const position = this.getPosition(offset);
    const lineContent = this.getLineContent(position.line);
    const indentation = getIndentation(lineContent, position.character);
    return indentation;
  }

  public findPreviousLineWithSameIndentation(offset: number, indentation: number): number {
    const position = this.getPosition(offset);
    const indentationSpaces = " ".repeat(indentation);
    let currentLine = position.line - 1;
    let found = false;

    while (currentLine > 0 && !found) {
      const lineContent = this.getLineContent(currentLine);
      if (lineContent.startsWith(indentationSpaces) && lineContent.charCodeAt(indentation + 1) !== CharCode.Space) {
        found = true;
      } else {
        currentLine--;
      }
    }
    return currentLine;
  }

  public isPositionAfterToken(position: Position, token: string): boolean {
    const lineContent = this.getLineContent(position.line);
    const tokenIndex = lineContent.lastIndexOf(token, position.character);
    if (tokenIndex === -1) {
      return false; // No token found
    }
    return tokenIndex < position.character;
  }
}
