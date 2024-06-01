import { ASTNode } from "@gxwf/server-common/src/ast/types";
import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  Position,
  Range,
} from "@gxwf/server-common/src/languageTypes";
import { TextBuffer } from "@gxwf/yaml-language-service/src/utils/textBuffer";
import { GxFormat2WorkflowDocument } from "../gxFormat2WorkflowDocument";
import { FieldSchemaNode, RecordSchemaNode, SchemaNode, SchemaNodeResolver } from "../schema";
import { EnumSchemaNode } from "../schema/definitions";

export class GxFormat2CompletionService {
  constructor(protected readonly schemaNodeResolver: SchemaNodeResolver) {}

  public doComplete(documentContext: GxFormat2WorkflowDocument, position: Position): Promise<CompletionList> {
    const textDocument = documentContext.textDocument;
    const nodeManager = documentContext.nodeManager;
    const result: CompletionList = {
      items: [],
      isIncomplete: false,
    };
    // TODO: Refactor most of this to an Context class with all the information around the cursor
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

    const currentWord = textBuffer.getCurrentWord(offset);
    const overwriteRange = textBuffer.getCurrentWordRange(offset);

    const existing = nodeManager.getDeclaredPropertyNames(node);
    const nodePath = nodeManager.getPathFromNode(node);
    const schemaNode = this.schemaNodeResolver.resolveSchemaContext(nodePath);
    if (schemaNode) {
      result.items = this.getProposedItems(schemaNode, currentWord, existing, overwriteRange);
    }
    return Promise.resolve(result);
  }

  private getProposedItems(
    schemaNode: SchemaNode,
    currentWord: string,
    exclude: Set<string>,
    overwriteRange: Range
  ): CompletionItem[] {
    const result: CompletionItem[] = [];
    if (schemaNode instanceof RecordSchemaNode) {
      schemaNode.fields
        .filter((f) => f.name.startsWith(currentWord))
        .forEach((field) => {
          if (exclude.has(field.name)) return;
          const item: CompletionItem = {
            label: field.name,
            documentation: field.documentation,
            sortText: `_${field.name}`,
            kind: CompletionItemKind.Field,
            insertText: `${field.name}: `,
            textEdit: {
              range: overwriteRange,
              newText: `${field.name}: `,
            },
          };
          result.push(item);
        });
    } else if (schemaNode instanceof FieldSchemaNode) {
      const schemaRecord = this.schemaNodeResolver.getSchemaNodeByTypeRef(schemaNode.typeRef);
      if (schemaRecord instanceof EnumSchemaNode) {
        schemaRecord.symbols
          .filter((v) => v.startsWith(currentWord))
          .forEach((value) => {
            if (exclude.has(value)) return;
            const item: CompletionItem = {
              label: value,
              sortText: `_${value}`,
              kind: CompletionItemKind.EnumMember,
              documentation: schemaRecord.documentation,
              insertText: value,
              textEdit: {
                range: overwriteRange,
                newText: value,
              },
            };
            result.push(item);
          });
      }
    }
    return result;
  }
}

function _DEBUG_printNodeName(node: ASTNode): void {
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
