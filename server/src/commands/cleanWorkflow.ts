import { TextDocument } from "vscode-languageserver-textdocument";
import { ASTNode, PropertyASTNode, WorkflowDocument } from "../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../server";
import { CustomCommand } from "./common";
import { CleanWorkflowContentsRequest, CleanWorkflowContentsResult } from "./requestsDefinitions";

const CLEANABLE_PROPERTY_NAMES = new Set(["position", "uuid", "errors", "version"]);

export class CleanWorkflowCommand extends CustomCommand {
  public static register(server: GalaxyWorkflowLanguageServer): CleanWorkflowCommand {
    return new CleanWorkflowCommand(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
  }

  protected listenToRequests(): void {
    this.connection.onRequest(CleanWorkflowContentsRequest.type, async (params) => {
      const tempDocument = this.createTempWorkflowDocumentWithContents(params.contents);
      const workflowDocument = this.languageService.parseWorkflowDocument(tempDocument);
      if (workflowDocument) {
        return await this.CleanWorkflowContentsResult(workflowDocument);
      }
      return undefined;
    });
  }

  private createTempWorkflowDocumentWithContents(contents: string) {
    return TextDocument.create("temp://temp-workflow", "galaxyworkflow", 0, contents);
  }

  private async CleanWorkflowContentsResult(workflowDocument: WorkflowDocument): Promise<CleanWorkflowContentsResult> {
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
