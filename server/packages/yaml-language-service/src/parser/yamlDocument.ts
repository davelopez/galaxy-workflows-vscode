import { TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic, DiagnosticSeverity, Position } from "vscode-languageserver-types";
import { Document, YAMLError, YAMLWarning } from "yaml";
import { TextBuffer } from "../utils/textBuffer";
import { ASTNode } from "./astTypes";

const FULL_LINE_ERROR = true;
const YAML_SOURCE = "YAML";

export class YAMLSubDocument {
  constructor(public readonly root: ASTNode | undefined, private readonly parsedDocument: Document) {}

  get errors(): YAMLError[] {
    return this.parsedDocument.errors;
  }
  get warnings(): YAMLWarning[] {
    return this.parsedDocument.warnings;
  }
}

export class YAMLDocument {
  private readonly _textBuffer: TextBuffer;
  private _diagnostics: Diagnostic[] | undefined;

  constructor(public readonly subDocuments: YAMLSubDocument[], public readonly textDocument: TextDocument) {
    this._textBuffer = new TextBuffer(textDocument);
    this._diagnostics = undefined;
  }

  public get firstDocument(): YAMLSubDocument | undefined {
    return this.subDocuments.at(0);
  }

  public get syntaxDiagnostics(): Diagnostic[] {
    if (!this._diagnostics) {
      this._diagnostics = this.getSyntaxDiagnostics();
    }
    return this._diagnostics;
  }

  private getSyntaxDiagnostics(): Diagnostic[] {
    const syntaxErrors = this.subDocuments.flatMap((subDoc) =>
      subDoc.errors.map((e) => this.YAMLErrorToDiagnostics(e))
    );
    const syntaxWarnings = this.subDocuments.flatMap((subDoc) =>
      subDoc.warnings.map((e) => this.YAMLErrorToDiagnostics(e))
    );
    return syntaxErrors.concat(syntaxWarnings);
  }

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
}
