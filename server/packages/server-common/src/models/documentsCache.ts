import { DocumentContext } from "../languageTypes";

export class DocumentsCache {
  private cache: Map<string, DocumentContext>;

  /**
   * Document URI schemes that represent temporal or readonly documents
   * that should not be cached.
   */
  public static schemesToSkip = ["temp", "galaxy-clean-workflow"];

  constructor() {
    this.cache = new Map<string, DocumentContext>();
  }

  public get(documentUri: string): DocumentContext | undefined {
    return this.cache.get(documentUri);
  }

  public all(): DocumentContext[] {
    return Array.from(this.cache.values());
  }

  public addOrReplaceDocument(documentContext: DocumentContext): void {
    if (DocumentsCache.schemesToSkip.includes(documentContext.uri.scheme)) {
      return;
    }
    this.cache.set(documentContext.uri.toString(), documentContext);
    // console.debug("Registering: ", document.uri.toString());
    // console.debug("Files registered: ", this.cache.size);
  }

  public removeDocument(documentUri: string): void {
    this.cache.delete(documentUri);
    // console.debug("Un-registering: ", documentUri);
    // console.debug("Files registered: ", this.cache.size);
  }

  public dispose(): void {
    this.cache.clear();
    //console.debug("Documents cache cleared");
  }
}
