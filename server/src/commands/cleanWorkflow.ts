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

const CLEANABLE_PROPERTY_NAMES = new Set(["position", "uuid", "errors", "version"]);

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
    const nodesToRemove = this.getNonEssentialNodes(workflowDocument.jsonDocument.root);
    const changes: TextEdit[] = [];
    nodesToRemove.forEach((node) => {
      const range = this.getReplaceRange(workflowDocument.textDocument, node);
      changes.push(TextEdit.replace(range, ""));
    });
    return changes;
  }

  private createTempWorkflowDocumentWithContents(contents: string) {
    return TextDocument.create("temp://temp-workflow", "galaxyworkflow", 0, contents);
  }

  private async cleanWorkflowContentsResult(workflowDocument: WorkflowDocument): Promise<CleanWorkflowContentsResult> {
    const nodesToRemove = this.getNonEssentialNodes(workflowDocument.jsonDocument.root);
    const contents = this.getCleanContents(workflowDocument.textDocument.getText(), nodesToRemove.reverse());
    const result: CleanWorkflowContentsResult = {
      contents: contents,
    };
    return result;
  }

  private getNonEssentialNodes(root: ASTNode | undefined): PropertyASTNode[] {
    if (!root) {
      return [];
    }
    const result: PropertyASTNode[] = [];
    const toVisit: { node: ASTNode }[] = [{ node: root }];
    let nextToVisit = 0;

    const collectNonEssentialProperties = (node: ASTNode) => {
      if (node.type === "array") {
        node.items.forEach((node) => {
          if (node) {
            toVisit.push({ node });
          }
        });
      } else if (node.type === "object") {
        node.properties.forEach((property: PropertyASTNode) => {
          const key = property.keyNode.value;
          if (CLEANABLE_PROPERTY_NAMES.has(key)) {
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

  private getFullNodeRangeOffsets(documentText: string, node: ASTNode) {
    let startPos = node.offset;
    let endPos = node.offset + node.length;
    startPos = documentText.lastIndexOf("\n", startPos);
    if (documentText.charAt(endPos) === ",") {
      endPos++;
    }
    return { start: startPos, end: endPos };
  }

  private getReplaceRange(document: TextDocument, node: ASTNode): Range {
    const documentText = document.getText();
    const rangeOffsets = this.getFullNodeRangeOffsets(documentText, node);
    return Range.create(document.positionAt(rangeOffsets.start), document.positionAt(rangeOffsets.end));
  }
}
