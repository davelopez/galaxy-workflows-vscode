import { WorkflowDocument } from "./workflowDocument";

export class WorkflowDocuments {
  private _documentsCache: Map<string, WorkflowDocument>;

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
    console.log("registered workflow file: ", document.documentUri);
    this._documentsCache.set(document.documentUri, document);
  }

  public removeWorkflowDocument(documentUri: string) {
    console.log("unregistered workflow file: ", documentUri);
    this._documentsCache.delete(documentUri);
  }

  public dispose() {
    this._documentsCache.clear();
    console.log("workflow document cache cleared");
  }
}
