import { WorkflowDocument, Position, HoverContentContributor } from "../../languageTypes";
import { ASTNode, PropertyASTNode } from "../../ast/types";
import { ArrayASTNode, BooleanASTNode, NullASTNode, NumberASTNode, StringASTNode } from "vscode-json-languageservice";

/**
 * This is a debugging helper Hover Provider to see metadata about the JSON parsing.
 */
export class DebugHoverContentContributor implements HoverContentContributor {
  public onHoverContent(workflowDocument: WorkflowDocument, position: Position): string {
    const node = workflowDocument.nodeManager.getNodeAtPosition(position);
    return node ? this.printNode(node) : "";
  }

  private printNode(node: ASTNode): string {
    const contentLines = [`**${node.type}**`];
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
    return contentLines.join("\n\n");
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
