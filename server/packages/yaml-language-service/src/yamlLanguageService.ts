import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic, FormattingOptions, TextEdit } from "vscode-languageserver-types";
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
  lineWidth?: number;
}

export interface LanguageService {
  configure(settings: LanguageSettings): void;
  parseYAMLDocument(document: TextDocument): YAMLDocument;
  doValidation(yamlDocument: YAMLDocument): Promise<Diagnostic[]>;
  doFormat(document: TextDocument, options: FormattingOptions & CustomFormatterOptions): TextEdit[];
}

export function getLanguageService(): LanguageService {
  const formatter = new YAMLFormatter();
  const validator = new YAMLValidation();
  return {
    configure: (settings: LanguageSettings) => {
      formatter.configure(settings);
      validator.configure(settings);
    },
    parseYAMLDocument: (document: TextDocument) => parseYAML(document),
    doValidation: (yamlDocument: YAMLDocument) => validator.doValidation(yamlDocument),
    doFormat: formatter.format.bind(formatter),
  };
}
