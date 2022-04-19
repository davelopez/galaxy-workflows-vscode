import { WorkflowDocument } from "./workflowDocument";

export class WorkflowDocuments {
  private _documentsCache: Map<string, WorkflowDocument>;

  /**
   * Workflow document URI schemes that represent temporal or readonly documents.
   */
  public static schemesToSkip = ["temp", "galaxy-clean-workflow"];

  constructor() {
    this._documentsCache = new Map<string, WorkflowDocument>();
  }

  public get(documentUri: string): WorkflowDocument | undefined {
    return this._documentsCache.get(documentUri);
  }

  public all(): WorkflowDocument[] {
    return Array.from(this._documentsCache.values());
  }

  public addOrReplaceWorkflowDocument(document: WorkflowDocument) {
    if (WorkflowDocuments.schemesToSkip.includes(document.uri.scheme)) {
      return;
    }
    this._documentsCache.set(document.uri.toString(), document);
    // console.debug("Registering: ", document.uri.toString());
    // console.debug("workflow files registered: ", this._documentsCache.size);
  }

  public removeWorkflowDocument(documentUri: string) {
    this._documentsCache.delete(documentUri);
    // console.debug("Un-registering: ", documentUri);
    // console.debug("workflow files registered: ", this._documentsCache.size);
  }

  public dispose() {
    this._documentsCache.clear();
    //console.debug("workflow document cache cleared");
  }
}
