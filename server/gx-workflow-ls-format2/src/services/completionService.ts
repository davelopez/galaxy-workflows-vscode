import { ASTNodeManager } from "@gxwf/server-common/src/ast/nodeManager";
import { ASTNode } from "@gxwf/server-common/src/ast/types";
import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  Position,
  TextDocument,
} from "@gxwf/server-common/src/languageTypes";
import { TextBuffer } from "@gxwf/yaml-language-service/src/utils/textBuffer";
import { SchemaNode, SchemaNodeResolver } from "../schema";

export class GxFormat2CompletionService {
  constructor(protected readonly schemaNodeResolver: SchemaNodeResolver) {}

  public doComplete(
    textDocument: TextDocument,
    position: Position,
    nodeManager: ASTNodeManager
  ): Promise<CompletionList> {
    const result: CompletionList = {
      items: [],
      isIncomplete: false,
    };

    const textBuffer = new TextBuffer(textDocument);
    const text = textBuffer.getText();
    const offset = textBuffer.getOffsetAt(position);
    const node = nodeManager.getNodeFromOffset(offset);
    if (!node) {
      return Promise.resolve(result);
    }
    if (text.charAt(offset - 1) === ":") {
      return Promise.resolve(result);
    }

    DEBUG_printNodeName(node);

    const existing = nodeManager.getDeclaredPropertyNames(node);
    if (nodeManager.isRoot(node)) {
      result.items = this.getProposedItems(this.schemaNodeResolver.rootNode, existing);
      return Promise.resolve(result);
    }
    const nodePath = nodeManager.getPathFromNode(node);
    const schemaNode = this.schemaNodeResolver.resolveSchemaContext(nodePath);
    if (schemaNode) {
      result.items = this.getProposedItems(schemaNode, existing);
    }
    return Promise.resolve(result);
  }

  private getProposedItems(schemaNode: SchemaNode, exclude: Set<string>): CompletionItem[] {
    const result: CompletionItem[] = [];
    schemaNode.children.forEach((child) => {
      if (exclude.has(child.name)) return;
      const item: CompletionItem = {
        label: child.name,
        documentation: child.documentation,
        sortText: `_${child.name}`,
        kind: CompletionItemKind.Field,
        insertText: `${child.name}: `,
      };
      result.push(item);
    });
    return result;
  }
}

function DEBUG_printNodeName(node: ASTNode): void {
  let nodeName = "_root_";
  if (node?.type === "property") {
    nodeName = node.keyNode.value;
    console.debug("COMPLETION NODE PROPERTY", nodeName);
  } else if (node?.type === "object") {
    console.debug(`COMPLETION NODE OBJECT:`);
    node.properties.forEach((p) => {
      console.debug(`  ${p.keyNode.value}`);
    });
  } else {
    console.debug("UNKNOWN");
  }
}
