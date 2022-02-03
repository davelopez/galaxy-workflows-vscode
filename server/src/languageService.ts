import { ASTNode, getLanguageService, LanguageService } from "vscode-json-languageservice";
import {
  TextDocument,
  Range,
  FormattingOptions,
  TextEdit,
  WorkflowDocument,
  WorkflowLanguageService,
} from "./languageTypes";

/**
 * A wrapper around the JSON Language Service to support language features
 * for native Galaxy workflow files AKA '.ga' workflows.
 */
export class NativeWorkflowLanguageService implements WorkflowLanguageService {
  private _jsonLanguageService: LanguageService;

  constructor() {
    this._jsonLanguageService = getLanguageService({});
  }

  public parseWorkflowDocument(document: TextDocument): WorkflowDocument {
    const jsonDocument = this._jsonLanguageService.parseJSONDocument(document);
    return new WorkflowDocument(document, jsonDocument);
  }

  public format(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[] {
    return this._jsonLanguageService.format(document, range, options);
  }
}

export function getRange(document: TextDocument, node: ASTNode) {
  return Range.create(document.positionAt(node.offset), document.positionAt(node.offset + node.length));
}
