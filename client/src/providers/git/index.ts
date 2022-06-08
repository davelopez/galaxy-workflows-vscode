import { Uri } from "vscode";

/**
 * Interface to retrieve information from Git.
 */
export interface GitProvider {
  /**
   * Indicates if this provider has been initialized
   * and can be used.
   */
  get isInitialized(): boolean;

  /**
   * Initializes this provider so it can be used.
   */
  initialize(): Promise<void>;

  /**
   * Gets the contents of a particular version of a document
   * from it's URI and a git reference.
   * @param uri The document URI
   * @param ref The Git reference
   */
  getContents(uri: Uri, ref: string): Promise<string>;
}
