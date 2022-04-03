import {
  ASTNode,
  getLanguageService,
  LanguageService,
  LanguageServiceParams,
  DocumentLanguageSettings,
  Diagnostic,
  JSONSchema,
} from "vscode-json-languageservice";
import {
  TextDocument,
  Range,
  FormattingOptions,
  TextEdit,
  WorkflowDocument,
  WorkflowLanguageService,
} from "./languageTypes";
import NativeSchema from "../../workflow-languages/schemas/native.schema.json";

/**
 * A wrapper around the JSON Language Service to support language features
 * for native Galaxy workflow files AKA '.ga' workflows.
 */
export class NativeWorkflowLanguageService implements WorkflowLanguageService {
  private _jsonLanguageService: LanguageService;
  private _galaxyNativeWorkflowSchema: JSONSchema = NativeSchema;
  private _documentSettings: DocumentLanguageSettings;

  constructor() {
    const params: LanguageServiceParams = {};
    this._jsonLanguageService = getLanguageService(params);
    this._documentSettings = {
      schemaValidation: "error",
    };
  }

  public parseWorkflowDocument(document: TextDocument): WorkflowDocument {
    const jsonDocument = this._jsonLanguageService.parseJSONDocument(document);
    return new WorkflowDocument(document, jsonDocument);
  }

  public format(document: TextDocument, range: Range, options: FormattingOptions): TextEdit[] {
    return this._jsonLanguageService.format(document, range, options);
  }

  public async doValidation(workflowDocument: WorkflowDocument): Promise<Diagnostic[]> {
    const schemaValidationResults = await this._jsonLanguageService.doValidation(
      workflowDocument.textDocument,
      workflowDocument.jsonDocument,
      this._documentSettings,
      this._galaxyNativeWorkflowSchema
    );
    return schemaValidationResults;
  }
}

export function getRange(document: TextDocument, node: ASTNode) {
  return Range.create(document.positionAt(node.offset), document.positionAt(node.offset + node.length));
}
