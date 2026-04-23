import { CompletionItem, CompletionItemKind, CompletionList, Position } from "@gxwf/server-common/src/languageTypes";
import type { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { TextBuffer } from "@gxwf/yaml-language-service/src/utils/textBuffer";
import { GxFormat2WorkflowDocument } from "../gxFormat2WorkflowDocument";
import { FieldSchemaNode, RecordSchemaNode, SchemaNode, SchemaNodeResolver } from "../schema";
import { EnumSchemaNode } from "../schema/definitions";
import { ToolStateCompletionService, findStateInPath, getCompletionTextContext } from "./toolStateCompletionService";
import { SourceInPath, findSourceInPath, getAvailableSources } from "./workflowConnectionService";

export class GxFormat2CompletionService {
  /**
   * Schema references that should be ignored when suggesting completions.
   * These are typically user-defined names and we cannot suggest completions for them.
   */
  private readonly ignoredSchemaRefs = new Set(["InputParameter", "OutputParameter", "WorkflowStep"]);

  private readonly toolStateService?: ToolStateCompletionService;

  constructor(
    protected readonly schemaNodeResolver: SchemaNodeResolver,
    toolRegistryService?: ToolRegistryService
  ) {
    if (toolRegistryService) {
      this.toolStateService = new ToolStateCompletionService(toolRegistryService);
    }
  }

  public async doComplete(documentContext: GxFormat2WorkflowDocument, position: Position): Promise<CompletionList> {
    const textDocument = documentContext.textDocument;
    const nodeManager = documentContext.nodeManager;
    const result: CompletionList = {
      items: [],
      isIncomplete: false,
    };
    const textBuffer = new TextBuffer(textDocument);
    const offset = textBuffer.getOffsetAt(position);
    let node = nodeManager.getNodeFromOffset(offset);

    if (node === undefined && !textBuffer.isEmpty()) {
      // Do not suggest completions if we cannot find a node at the current position
      // If the document is empty, we can still suggest the root properties
      return result;
    }

    const nodePath = nodeManager.getPathFromNode(node);

    // Check if cursor is inside a step's in: source field
    const sourceInfo: SourceInPath | undefined = findSourceInPath(nodePath);
    if (sourceInfo) {
      const position = textBuffer.getPosition(offset);
      const afterColon = textBuffer.isPositionAfterToken(position, ":");
      // For the map shorthand form, path[n-1] is the input name, not "source".
      // Only offer source completions when cursor is after the colon (value position).
      const pathEndsWithSource = nodePath[nodePath.length - 1] === "source";
      if (pathEndsWithSource || afterColon) {
        const currentWord = textBuffer.getCurrentWord(offset);
        const overwriteRange = textBuffer.getCurrentWordRange(offset);
        const sources = getAvailableSources(documentContext, sourceInfo.stepName);
        result.items = sources
          .filter((s) => s.startsWith(currentWord))
          .map((s) => ({
            label: s,
            kind: CompletionItemKind.Reference,
            sortText: `_${s}`,
            insertText: s,
            textEdit: { range: overwriteRange, newText: s },
          }));
        return result;
      }
    }

    // Check if cursor is inside a step's state/tool_state block
    const stateInfo = findStateInPath(nodePath);
    if (stateInfo && this.toolStateService) {
      const existing = nodeManager.getDeclaredPropertyNames(node);
      const textCtx = getCompletionTextContext(textDocument, offset);
      result.items = await this.toolStateService.doComplete(nodeManager.root, nodePath, stateInfo, textCtx, existing);
      return result;
    }

    let schemaNode = this.schemaNodeResolver.resolveSchemaContext(nodePath);
    if (schemaNode === undefined) {
      // Try parent node
      node = node?.parent;
      const parentPath = nodePath.slice(0, -1);
      const parentNode = this.schemaNodeResolver.resolveSchemaContext(parentPath);
      schemaNode = parentNode;
    }
    if (schemaNode) {
      const existing = nodeManager.getDeclaredPropertyNames(node);
      result.items = this.getProposedItems(schemaNode, textBuffer, existing, offset);
    }
    return result;
  }

  private getProposedItems(
    schemaNode: SchemaNode,
    textBuffer: TextBuffer,
    exclude: Set<string>,
    offset: number
  ): CompletionItem[] {
    const result: CompletionItem[] = [];
    const currentWord = textBuffer.getCurrentWord(offset);
    const overwriteRange = textBuffer.getCurrentWordRange(offset);
    const position = textBuffer.getPosition(offset);
    const isPositionAfterColon = textBuffer.isPositionAfterToken(position, ":");
    if (schemaNode instanceof EnumSchemaNode) {
      if (schemaNode.canBeAny) return result;

      schemaNode.symbols
        .filter((v) => v.startsWith(currentWord))
        .forEach((value) => {
          if (exclude.has(value)) return;
          const item: CompletionItem = {
            label: value,
            sortText: `_${value}`,
            kind: CompletionItemKind.EnumMember,
            documentation: schemaNode.documentation,
            insertText: value,
            textEdit: {
              range: overwriteRange,
              newText: value,
            },
          };
          result.push(item);
        });
    } else if (schemaNode instanceof RecordSchemaNode) {
      if (isPositionAfterColon) {
        return result; // Do not suggest fields inlined after colon
      }
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
      if (schemaNode.isPrimitiveType) {
        const defaultValue = String(schemaNode.default ?? "");
        if (defaultValue) {
          const item: CompletionItem = {
            label: defaultValue,
            kind: CompletionItemKind.Value,
            documentation: schemaNode.documentation,
            insertText: defaultValue,
            textEdit: {
              range: overwriteRange,
              newText: defaultValue,
            },
          };
          result.push(item);
          return result;
        }
      } else if (schemaNode.isUnionType) {
        for (const typeRef of schemaNode.typeRefs) {
          const typeNode = this.schemaNodeResolver.getSchemaNodeByTypeRef(typeRef);
          if (typeNode === undefined) continue;
          result.push(...this.getProposedItems(typeNode, textBuffer, exclude, offset));
        }
        return result;
      }

      if (this.ignoredSchemaRefs.has(schemaNode.typeRef)) {
        return result;
      }

      const schemaRecord = this.schemaNodeResolver.getSchemaNodeByTypeRef(schemaNode.typeRef);
      if (schemaRecord) {
        return this.getProposedItems(schemaRecord, textBuffer, exclude, offset);
      }
    }
    return result;
  }
}
