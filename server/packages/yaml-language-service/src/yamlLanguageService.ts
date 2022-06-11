import { ASTNode } from "vscode-json-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";
import { FormattingOptions, Hover, Position, TextEdit } from "vscode-languageserver-types";
import { YAMLFormatter } from "./services/yamlFormatter";

export declare type YAMLDocument = {
  root: ASTNode | undefined;
  getNodeFromOffset(offset: number, includeRightBound?: boolean): ASTNode | undefined;
};

export interface LanguageSettings {
  format?: boolean; //Setting for whether we want to have the formatter or not
}

export interface CustomFormatterOptions {
  singleQuote?: boolean;
  bracketSpacing?: boolean;
  proseWrap?: string;
  printWidth?: number;
  enable?: boolean;
}

export interface LanguageService {
  doFormat(document: TextDocument, options: FormattingOptions & CustomFormatterOptions): TextEdit[];
  doHover(document: TextDocument, position: Position): Hover | null;
}

export function getLanguageService(): LanguageService {
  const formatter = new YAMLFormatter();
  return {
    doFormat: formatter.format.bind(formatter),
    doHover: (doc, pos) => {
      return null;
    },
  };
}
