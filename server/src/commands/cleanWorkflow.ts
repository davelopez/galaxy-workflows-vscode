import { TextDocument } from "vscode-languageserver-textdocument";
import { ASTNode, PropertyASTNode, WorkflowDocument } from "../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../server";
import { CustomCommand } from "./common";
import {
  CleanWorkflowContentsRequest,
  CleanWorkflowDocument,
  CleanWorkflowDocumentRequest,
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
    this.connection.onRequest(CleanWorkflowDocumentRequest.type, async (params) => {
      const workflowDocument = this.workflowDocuments.get(params.uri);
      if (workflowDocument) {
        return await this.cleanWorkflowDocument(workflowDocument);
      }
      return undefined;
    });

    this.connection.onRequest(CleanWorkflowContentsRequest.type, async (params) => {
      const tempDocument = TextDocument.create("temp://temp-workflow.json", "galaxyworkflow", 0, params.contents);
      const workflowDocument = this.languageService.parseWorkflowDocument(tempDocument);
      if (workflowDocument) {
        return await this.cleanWorkflowDocument(workflowDocument);
      }
      return undefined;
    });
  }

  private async cleanWorkflowDocument(workflowDocument: WorkflowDocument): Promise<CleanWorkflowDocument> {
    const nodesToRemove = this.getNonEssentialNodes(workflowDocument.jsonDocument.root);
    const contents = this.getCleanContents(workflowDocument.textDocument.getText(), nodesToRemove.reverse());
    const result: CleanWorkflowDocument = {
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
      let startPos = node.offset;
      let endPos = node.offset + node.length;
      startPos = documentText.lastIndexOf("\n", startPos);
      if (documentText.charAt(endPos) === ",") {
        endPos++;
      }
      removeChunks.push(documentText.substring(startPos, endPos));
    });
    removeChunks.forEach((chunk) => {
      result = result.replace(chunk, "");
    });
    return result;
  }
}
