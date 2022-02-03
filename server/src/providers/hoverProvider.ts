import { Hover, HoverParams, MarkupKind, Position, ASTNode, WorkflowDocument, PropertyASTNode } from "../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../server";
import { Provider } from "./provider";
import { getRange } from "../languageService";
import { ArrayASTNode, BooleanASTNode, NullASTNode, NumberASTNode, StringASTNode } from "vscode-json-languageservice";

export class HoverProvider extends Provider {
  public static register(server: GalaxyWorkflowLanguageServer): HoverProvider {
    return new HoverProvider(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.connection.onHover((params) => this.onHoverShowParsingData(params));
  }

  /**
   * This is a temporary Hover provider to see metadata about the JSON parsing.
   * Will be replaced by a proper one at some point before the first release.
   */
  private onHoverShowParsingData(params: HoverParams): Hover | undefined {
    const workflowDocument = this.workflowDocuments.get(params.textDocument.uri);
    if (!workflowDocument) {
      return undefined;
    }
    const node = this.getNodeAtDocumentPosition(workflowDocument, params.position);
    if (!node) {
      return undefined;
    }
    const contentLines = this.printNode(node);
    const hoverRange = getRange(workflowDocument.textDocument, node);
    const markdown = {
      kind: MarkupKind.Markdown,
      value: contentLines.join("\n\n"),
    };
    const result: Hover = {
      contents: markdown,
      range: hoverRange,
    };
    return result;
  }

  private getNodeAtDocumentPosition(workflowDocument: WorkflowDocument, position: Position): ASTNode | undefined {
    const document = workflowDocument.textDocument;
    const offset = document.offsetAt(position);
    const node = workflowDocument.jsonDocument.getNodeFromOffset(offset);
    return node;
  }

  private printNode(node: ASTNode): string[] {
    const contentLines = [`## ${node.type}`];
    if (node.type === "object") {
      for (const property of node.properties) {
        contentLines.push(this.printNodeProperty(property));
      }
    } else if (node.type === "array") {
      contentLines.push(this.printArrayNode(node));
    } else if (node.type === "property") {
      contentLines.push(this.printNodeProperty(node));
    } else {
      contentLines.push(this.printNodeValue(node));
    }
    return contentLines;
  }

  private printNodeProperty(property: PropertyASTNode): string {
    return `[${property.valueNode?.type}]\`${property.keyNode.value}\`: ${
      property.valueNode?.value || "hover children for details"
    }`;
  }

  private printArrayNode(node: ArrayASTNode): string {
    const nodeStr = `${node.items.length} items (${node.offset}, ${node.offset + node.length})\n`;
    const itemsStr: string[] = [];
    node.items.forEach((item) => {
      itemsStr.push(`  - [${item.type}] (${item.offset}, ${item.offset + item.length})\n`);
    });
    return nodeStr.concat(...itemsStr);
  }

  private printNodeValue(node: StringASTNode | NumberASTNode | BooleanASTNode | NullASTNode): string {
    return `\`${node.value}\`: (${node.offset}, ${node.offset + node.length})`;
  }
}
