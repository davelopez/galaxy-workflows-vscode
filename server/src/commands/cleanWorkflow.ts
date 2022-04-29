import { ApplyWorkspaceEditParams, Range, TextDocumentEdit, TextEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ASTNode, PropertyASTNode, WorkflowDocument } from "../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../server";
import { CustomCommand } from "./common";
import {
  CleanWorkflowContentsParams,
  CleanWorkflowContentsRequest,
  CleanWorkflowContentsResult,
  CleanWorkflowDocumentParams,
  CleanWorkflowDocumentRequest,
  CleanWorkflowDocumentResult,
} from "./requestsDefinitions";

/**
 * A set of property names that are unrelated to the workflow logic.
 * Usually used by other tools like the workflow editor.
 */
const CLEANABLE_PROPERTY_NAMES = new Set(["position", "uuid", "errors", "version"]);

/**
 * Command for handling workflow `cleaning` requests.
 * Supports both, direct contents (raw document text), and document uri requests
 * for cleaning.
 * When requesting with a document uri, the workflow document must be already registered in the server
 * as a workflow document.
 */
export class CleanWorkflowCommand extends CustomCommand {
  public static register(server: GalaxyWorkflowLanguageServer): CleanWorkflowCommand {
    return new CleanWorkflowCommand(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
  }

  protected listenToRequests(): void {
    this.connection.onRequest(CleanWorkflowContentsRequest.type, (params) =>
      this.onCleanWorkflowContentsRequest(params)
    );
    this.connection.onRequest(CleanWorkflowDocumentRequest.type, (params) =>
      this.onCleanWorkflowDocumentRequest(params)
    );
  }

  /**
   * Processes a `CleanWorkflowContentsRequest` by returning the `clean` contents
   * of a workflow document given the raw text contents of the workflow document.
   * @param params The request parameters containing the raw text contents of the workflow
   * @returns The `clean` contents of the workflow document
   */
  private async onCleanWorkflowContentsRequest(
    params: CleanWorkflowContentsParams
  ): Promise<CleanWorkflowContentsResult | undefined> {
    const tempDocument = this.createTempWorkflowDocumentWithContents(params.contents);
    const workflowDocument = this.languageService.parseWorkflowDocument(tempDocument);
    if (workflowDocument) {
      return await this.cleanWorkflowContentsResult(workflowDocument);
    }
    return undefined;
  }

  /**
   * Applies the necessary text edits to the workflow document identified by the given URI to
   * remove all the properties in the workflow that are unrelated to the essential workflow logic.
   * @param params The request parameters containing the URI of the workflow document.
   * @returns An error message if something went wrong
   */
  private async onCleanWorkflowDocumentRequest(
    params: CleanWorkflowDocumentParams
  ): Promise<CleanWorkflowDocumentResult> {
    try {
      const workflowDocument = this.workflowDocuments.get(params.uri);
      if (workflowDocument) {
        const edits = this.getTextEditsToCleanWorkflow(workflowDocument);
        const editParams: ApplyWorkspaceEditParams = {
          label: "Clean workflow",
          edit: {
            documentChanges: [
              TextDocumentEdit.create(
                {
                  uri: params.uri,
                  version: null,
                },
                edits
              ),
            ],
          },
        };
        this.connection.workspace.applyEdit(editParams);
      }
      return { error: "" };
    } catch (error) {
      return { error: String(error) };
    }
  }

  private getTextEditsToCleanWorkflow(workflowDocument: WorkflowDocument): TextEdit[] {
    const nodesToRemove = this.getNonEssentialNodes(workflowDocument, CLEANABLE_PROPERTY_NAMES);
    const changes: TextEdit[] = [];
    nodesToRemove.forEach((node) => {
      const range = this.getFullNodeRange(workflowDocument.textDocument, node);
      changes.push(TextEdit.replace(range, ""));

      // Remove trailing comma in previous property node
      const isLastNode = workflowDocument.isLastNodeInParent(node);
      if (isLastNode) {
        const previousNode = workflowDocument.getPreviousSiblingNode(node);
        if (previousNode) {
          const range = this.getFullNodeRange(workflowDocument.textDocument, previousNode);
          const nodeText = workflowDocument.textDocument.getText(range);
          if (nodeText.endsWith(",")) {
            const nodeTextWithoutTrailingComma = nodeText.slice(0, -1);
            changes.push(TextEdit.replace(range, nodeTextWithoutTrailingComma));
          }
        }
      }
    });
    return changes;
  }

  private createTempWorkflowDocumentWithContents(contents: string): TextDocument {
    return TextDocument.create("temp://temp-workflow", "galaxyworkflow", 0, contents);
  }

  private async cleanWorkflowContentsResult(workflowDocument: WorkflowDocument): Promise<CleanWorkflowContentsResult> {
    const nodesToRemove = this.getNonEssentialNodes(workflowDocument, CLEANABLE_PROPERTY_NAMES);
    const contents = this.getCleanContents(workflowDocument.textDocument.getText(), nodesToRemove.reverse());
    const result: CleanWorkflowContentsResult = {
      contents: contents,
    };
    return result;
  }

  private getNonEssentialNodes(
    workflowDocument: WorkflowDocument,
    cleanablePropertyNames: Set<string>
  ): PropertyASTNode[] {
    const root = workflowDocument.jsonDocument.root;
    if (!root) {
      return [];
    }
    const result: PropertyASTNode[] = [];
    const toVisit: { node: ASTNode }[] = [{ node: root }];
    let nextToVisit = 0;

    const collectNonEssentialProperties = (node: ASTNode): void => {
      if (node.type === "array") {
        node.items.forEach((node) => {
          if (node) {
            toVisit.push({ node });
          }
        });
      } else if (node.type === "object") {
        node.properties.forEach((property: PropertyASTNode) => {
          const key = property.keyNode.value;
          if (cleanablePropertyNames.has(key)) {
            result.push(property);
          }
          if (property.valueNode) {
            toVisit.push({ node: property.valueNode });
          }
        });
      }
    };

    while (nextToVisit < toVisit.length) {
      const next = toVisit[nextToVisit++];
      collectNonEssentialProperties(next.node);
    }

    return result;
  }

  private getCleanContents(documentText: string, nodesToRemove: ASTNode[]): string {
    const removeChunks: string[] = [];
    let result = documentText;
    nodesToRemove.forEach((node) => {
      const rangeOffsets = this.getFullNodeRangeOffsets(documentText, node);
      removeChunks.push(documentText.substring(rangeOffsets.start, rangeOffsets.end));
    });
    removeChunks.forEach((chunk) => {
      result = result.replace(chunk, "");
    });
    return result;
  }

  /**
   * Gets the range offsets (`start` and `end`) for a given syntax node including
   * the blank spaces/indentation before and after the node and possible ending comma.
   * @param documentText The full workflow document text
   * @param node The syntax node
   * @returns The `start` and `end` offsets for the given syntax node
   */
  private getFullNodeRangeOffsets(documentText: string, node: ASTNode): { start: number; end: number } {
    let startPos = node.offset;
    let endPos = node.offset + node.length;
    startPos = documentText.lastIndexOf("\n", startPos);
    if (documentText.charAt(endPos) === ",") {
      endPos++;
    }
    return { start: startPos, end: endPos };
  }

  private getFullNodeRange(document: TextDocument, node: ASTNode): Range {
    const documentText = document.getText();
    const rangeOffsets = this.getFullNodeRangeOffsets(documentText, node);
    return Range.create(document.positionAt(rangeOffsets.start), document.positionAt(rangeOffsets.end));
  }
}
