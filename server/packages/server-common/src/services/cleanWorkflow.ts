import { ApplyWorkspaceEditParams, Range, TextDocumentEdit, TextEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { ServiceBase } from ".";
import { ASTNode, PropertyASTNode } from "../ast/types";
import { GalaxyWorkflowLanguageServer, WorkflowDocument } from "../languageTypes";
import {
  CleanWorkflowContentsParams,
  CleanWorkflowContentsResult,
  CleanWorkflowDocumentParams,
  CleanWorkflowDocumentResult,
  LSRequestIdentifiers,
} from "./requestsDefinitions";

/**
 * Service for handling workflow `cleaning` requests.
 * Supports both, direct contents (raw document text), and document uri requests
 * for cleaning.
 * When requesting with a document uri, the workflow document must be already registered in the server
 * as a workflow document.
 */
export class CleanWorkflowService extends ServiceBase {
  public static register(server: GalaxyWorkflowLanguageServer): CleanWorkflowService {
    return new CleanWorkflowService(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
  }

  protected listenToRequests(): void {
    this.server.connection.onRequest(
      LSRequestIdentifiers.CLEAN_WORKFLOW_CONTENTS,
      (params: CleanWorkflowContentsParams) => this.onCleanWorkflowContentsRequest(params)
    );
    this.server.connection.onRequest(
      LSRequestIdentifiers.CLEAN_WORKFLOW_DOCUMENT,
      (params: CleanWorkflowDocumentParams) => this.onCleanWorkflowDocumentRequest(params)
    );
  }

  /**
   * Processes a `CLEAN_WORKFLOW_DOCUMENT` request by returning the `clean` contents
   * of a workflow document given the raw text contents of the workflow document.
   * @param params The request parameters containing the raw text contents of the workflow
   * @returns The `clean` contents of the workflow document
   */
  private async onCleanWorkflowContentsRequest(
    params: CleanWorkflowContentsParams
  ): Promise<CleanWorkflowContentsResult | undefined> {
    const tempDocument = this.createTempWorkflowDocumentWithContents(params.contents);
    const workflowLanguageService = this.server.getLanguageServiceById(tempDocument.languageId);
    const workflowDocument = workflowLanguageService.parseDocument(tempDocument) as WorkflowDocument;
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
      const workflowDocument = this.server.documentsCache.get(params.uri);
      if (workflowDocument) {
        const settings = await this.server.configService.getDocumentSettings(workflowDocument.textDocument.uri);
        const edits = this.getTextEditsToCleanWorkflow(
          workflowDocument as WorkflowDocument,
          settings.cleaning.cleanableProperties
        );
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
        this.server.connection.workspace.applyEdit(editParams);
      }
      return { error: "" };
    } catch (error) {
      return { error: String(error) };
    }
  }

  private getTextEditsToCleanWorkflow(
    workflowDocument: WorkflowDocument,
    cleanablePropertyNames: string[]
  ): TextEdit[] {
    const nodesToRemove = this.getNonEssentialNodes(workflowDocument, cleanablePropertyNames);
    const changes: TextEdit[] = [];
    nodesToRemove.forEach((node) => {
      const range = this.getFullNodeRange(workflowDocument.textDocument, node);
      changes.push(TextEdit.replace(range, ""));

      // Remove trailing comma in previous property node
      const isLastNode = workflowDocument.nodeManager.isLastNodeInParent(node);
      if (isLastNode) {
        let previousNode = workflowDocument.nodeManager.getPreviousSiblingNode(node);
        while (previousNode && nodesToRemove.includes(previousNode)) {
          previousNode = workflowDocument.nodeManager.getPreviousSiblingNode(previousNode);
        }
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
    const settings = await this.server.configService.getDocumentSettings(workflowDocument.textDocument.uri);
    const nodesToRemove = this.getNonEssentialNodes(workflowDocument, settings.cleaning.cleanableProperties);
    const contents = this.getCleanContents(workflowDocument.textDocument.getText(), nodesToRemove.reverse());
    const result: CleanWorkflowContentsResult = {
      contents: contents,
    };
    return result;
  }

  private getNonEssentialNodes(workflowDocument: WorkflowDocument, cleanablePropertyNames: string[]): ASTNode[] {
    const root = workflowDocument.nodeManager.root;
    if (!root) {
      return [];
    }
    const result: PropertyASTNode[] = [];
    const toVisit: { node: ASTNode }[] = [{ node: root }];
    let nextToVisit = 0;

    const cleanablePropertyNamesSet = new Set(cleanablePropertyNames);
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
          if (cleanablePropertyNamesSet.has(key)) {
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
