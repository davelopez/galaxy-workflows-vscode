import { getLanguageService } from "vscode-json-languageservice";
import {
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  Position,
  Range,
} from "vscode-languageserver/browser";
import { FormattingOptions, TextDocument, TextEdit } from "../languageTypes";

const _jsonLanguageService = getLanguageService({});

export function onDocumentFormatting(document: TextDocument, params: DocumentFormattingParams): TextEdit[] {
  return onFormat(document, undefined, params.options);
}

export function onDocumentRangeFormatting(document: TextDocument, params: DocumentRangeFormattingParams): TextEdit[] {
  return onFormat(document, params.range, params.options);
}

function onFormat(document: TextDocument, range: Range | undefined, options: FormattingOptions): TextEdit[] {
  if (document) {
    const edits = _jsonLanguageService.format(document, range ?? getFullRange(document), options);
    return edits;
  }
  return [];
}

function getFullRange(document: TextDocument): Range {
  return Range.create(Position.create(0, 0), document.positionAt(document.getText().length));
}
