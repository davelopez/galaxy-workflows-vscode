"use strict";

import { Range, Position, TextEdit, FormattingOptions } from "vscode-languageserver-types";
import { CustomFormatterOptions, LanguageSettings } from "../yamlLanguageService";
import { TextDocument } from "vscode-languageserver-textdocument";

export class YAMLFormatter {
  private formatterEnabled = true;

  public configure(shouldFormat: LanguageSettings): void {
    if (shouldFormat) {
      this.formatterEnabled = shouldFormat.format || false;
    }
  }

  public format(document: TextDocument, options: FormattingOptions & CustomFormatterOptions): TextEdit[] {
    if (!this.formatterEnabled) {
      return [];
    }

    try {
      const text = document.getText();
      // TODO implement formatter
      const formatted = text;

      return [TextEdit.replace(Range.create(Position.create(0, 0), document.positionAt(text.length)), formatted)];
    } catch (error) {
      return [];
    }
  }
}
