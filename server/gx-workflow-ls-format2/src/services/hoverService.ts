import { NodePath } from "@gxwf/server-common/src/ast/types";
import { Hover, MarkupContent, MarkupKind, Position, Range } from "@gxwf/server-common/src/languageTypes";
import { GxFormat2WorkflowDocument } from "../gxFormat2WorkflowDocument";
import { SchemaNode, SchemaNodeResolver } from "../schema";

export class GxFormat2HoverService {
  constructor(protected readonly schemaNodeResolver: SchemaNodeResolver) {}

  //Based on https://github.com/microsoft/vscode-json-languageservice/blob/12275e448a91973777c94a2e5d92c961f281231a/src/services/jsonHover.ts#L23
  public async doHover(documentContext: GxFormat2WorkflowDocument, position: Position): Promise<Hover | null> {
    const textDocument = documentContext.textDocument;
    const nodeManager = documentContext.nodeManager;
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

    const hoverRange = nodeManager.getNodeRange(hoverRangeNode);
    const location = nodeManager.getPathFromNode(hoverRangeNode);
    const schemaNode = this.schemaNodeResolver.resolveSchemaContext(location);
    const contents = this.getHoverMarkdownContentsForNode(schemaNode);
    // DEBUG
    //contents.push(...this.debugInfo(location, schemaNode));
    const hover = this.createHover(contents.join("\n\n"), hoverRange);
    return Promise.resolve(hover);
  }

  private getHoverMarkdownContentsForNode(schemaNode?: SchemaNode): string[] {
    const contents = [];
    if (schemaNode) {
      contents.push(`**${schemaNode?.name}**`);
      contents.push(schemaNode?.documentation || "Doc not found");
    } else {
      contents.push("Schema node not found");
    }
    return contents;
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

  private debugInfo(location: NodePath, schemaNode?: SchemaNode): string[] {
    return ["---", `## ${location}`, "---", `${this.toMarkdownFencedCodeBlock(schemaNode)}`];
  }

  private toMarkdownFencedCodeBlock(object: unknown): string {
    return "```json\n" + `${JSON.stringify(object, null, 2)}` + "\n```";
  }
}
