import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic, FormattingOptions, Hover, Position, TextEdit } from "vscode-languageserver-types";
import { YAMLFormatter } from "./services/yamlFormatter";
import { parse as parseYAML, YAMLDocument } from "./parser";
import { YAMLValidation } from "./services/yamlValidation";

export interface LanguageSettings {
  validate?: boolean;
  format?: boolean;
  indentation?: string;
}

export interface CustomFormatterOptions {
  singleQuote?: boolean;
  bracketSpacing?: boolean;
  proseWrap?: string;
  printWidth?: number;
  enable?: boolean;
}

export interface LanguageService {
  parseYAMLDocument(document: TextDocument): YAMLDocument;
  doValidation(yamlDocument: YAMLDocument): Promise<Diagnostic[]>;
  doFormat(document: TextDocument, options: FormattingOptions & CustomFormatterOptions): TextEdit[];
  doHover(document: TextDocument, position: Position): Hover | null;
}

export function getLanguageService(): LanguageService {
  const formatter = new YAMLFormatter();
  const validator = new YAMLValidation();
  return {
    parseYAMLDocument: (document: TextDocument) => parseYAML(document),
    doValidation: (yamlDocument: YAMLDocument) => validator.doValidation(yamlDocument),
    doFormat: formatter.format.bind(formatter),
    doHover: (doc, pos) => {
      return null;
    },
  };
}
