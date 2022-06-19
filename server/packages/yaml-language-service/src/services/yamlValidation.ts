import { Diagnostic } from "vscode-languageserver-types";
import { YAMLDocument } from "../parser";
import { LanguageSettings } from "../yamlLanguageService";

export class YAMLValidation {
  private validationEnabled?: boolean;

  constructor() {
    this.validationEnabled = true;
  }

  public configure(settings: LanguageSettings): void {
    if (settings) {
      this.validationEnabled = settings.validate;
    }
  }

  public async doValidation(yamlDocument: YAMLDocument): Promise<Diagnostic[]> {
    if (!this.validationEnabled) {
      return Promise.resolve([]);
    }
    const diagnostics: Diagnostic[] = [...yamlDocument.syntaxDiagnostics];
    // TODO: add schema validation diagnostics

    return Promise.resolve(diagnostics);
  }
}
