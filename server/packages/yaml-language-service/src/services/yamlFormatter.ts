import { TextDocument } from "vscode-languageserver-textdocument";
import { FormattingOptions, Position, Range, TextEdit } from "vscode-languageserver-types";
import { ToStringOptions, parse, stringify } from "yaml";
import { CustomFormatterOptions, LanguageSettings } from "../yamlLanguageService";

export class YAMLFormatter {
  private formatterEnabled? = true;

  public configure(settings: LanguageSettings): void {
    if (settings) {
      this.formatterEnabled = settings.format;
    }
  }

  public format(document: TextDocument, options: FormattingOptions & CustomFormatterOptions): TextEdit[] {
    if (!this.formatterEnabled) {
      return [];
    }

    try {
      const text = document.getText();
      const ymlDoc = parse(text);
      const yamlFormatOptions: ToStringOptions = {
        singleQuote: options.singleQuote,
        lineWidth: options.lineWidth,
        indent: options.tabSize,
      };
      const formatted = stringify(ymlDoc, yamlFormatOptions);

      return [TextEdit.replace(Range.create(Position.create(0, 0), document.positionAt(text.length)), formatted)];
    } catch (error) {
      console.debug("Error formatting YAML document", error);
      return [];
    }
  }
}
