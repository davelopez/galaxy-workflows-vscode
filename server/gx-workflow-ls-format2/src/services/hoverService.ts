import { ASTNodeManager } from "@gxwf/server-common/src/ast/nodeManager";
import { NodePath } from "@gxwf/server-common/src/ast/types";
import { Hover, MarkupContent, MarkupKind, Position, Range, TextDocument } from "@gxwf/server-common/src/languageTypes";
import { ResolvedSchema } from "../schema/definitions";

export class GxFormat2HoverService {
  constructor(protected readonly resolvedSchema: ResolvedSchema) {}

  //Based on https://github.com/microsoft/vscode-json-languageservice/blob/12275e448a91973777c94a2e5d92c961f281231a/src/services/jsonHover.ts#L23
  public async doHover(
    textDocument: TextDocument,
    position: Position,
    nodeManager: ASTNodeManager
  ): Promise<Hover | null> {
    const offset = textDocument.offsetAt(position);
    let node = nodeManager.getNodeFromOffset(offset);
    if (
      !node ||
      ((node.type === "object" || node.type === "array") &&
        offset > node.offset + 1 &&
        offset < node.offset + node.length - 1)
    ) {
      return Promise.resolve(null);
    }
    const hoverRangeNode = node;

    // use the property description when hovering over an object key
    if (node.type === "string") {
      const parent = node.parent;
      if (parent && parent.type === "property" && parent.keyNode === node) {
        node = parent.valueNode;
        if (!node) {
          return Promise.resolve(null);
        }
      }
    }

    const hoverRange = Range.create(
      textDocument.positionAt(hoverRangeNode.offset),
      textDocument.positionAt(hoverRangeNode.offset + hoverRangeNode.length)
    );

    const location = nodeManager.getPathFromNode(hoverRangeNode);
    const nodeDoc = this.getDocFromNodePath(location);
    const contents = "**Debug Test**\n\n" + nodeDoc;
    const hover = this.createHover(contents, hoverRange);
    return Promise.resolve(hover);
  }

  private getDocFromNodePath(path: NodePath): string {
    const schemaNode = this.resolvedSchema.resolveSchemaContext(path);
    if (!schemaNode) return "Node not found";
    return schemaNode.documentation || "Doc not found";
  }

  private createHover(contents: string, hoverRange: Range): Hover {
    const markupContent: MarkupContent = {
      kind: MarkupKind.Markdown,
      value: contents,
    };
    const result: Hover = {
      contents: markupContent,
      range: hoverRange,
    };
    return result;
  }
}
