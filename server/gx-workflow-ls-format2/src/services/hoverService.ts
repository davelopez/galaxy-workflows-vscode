import { findParamAtPath } from "@galaxy-tool-util/schema";
import type { ASTNode, NodePath } from "@gxwf/server-common/src/ast/types";
import { Hover, MarkupContent, MarkupKind, Position, Range } from "@gxwf/server-common/src/languageTypes";
import type { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import {
  astObjectNodeToRecord,
  buildParamHoverMarkdown,
  getObjectNodeFromStep,
  getStringPropertyFromStep,
} from "@gxwf/server-common/src/providers/validation/toolStateAstHelpers";
import { buildToolIdHover } from "@gxwf/server-common/src/providers/hover/toolIdHover";
import { GxFormat2WorkflowDocument } from "../gxFormat2WorkflowDocument";
import { SchemaNode, SchemaNodeResolver } from "../schema";
import { findStateInPath } from "./toolStateCompletionService";
import { ToolParam } from "./toolStateTypes";

export class GxFormat2HoverService {
  constructor(
    protected readonly schemaNodeResolver: SchemaNodeResolver,
    private readonly toolRegistryService?: ToolRegistryService
  ) {}

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

    if (this.toolRegistryService) {
      const toolIdHover = await buildToolIdHover({
        nodeManager,
        offset,
        registry: this.toolRegistryService,
      });
      if (toolIdHover) return toolIdHover;
    }

    // Check if cursor is inside a step's state/tool_state block
    const stateInfo = findStateInPath(location);
    if (stateInfo && this.toolRegistryService) {
      const stateHover = await this.getToolStateHover(documentContext, location, stateInfo, hoverRange);
      if (stateHover) return stateHover;
    }

    const schemaNode = this.schemaNodeResolver.resolveSchemaContext(location);
    const contents = this.getHoverMarkdownContentsForNode(schemaNode);
    const hover = this.createHover(contents.join("\n\n"), hoverRange);
    return Promise.resolve(hover);
  }

  private async getToolStateHover(
    documentContext: GxFormat2WorkflowDocument,
    location: NodePath,
    stateInfo: { stateIndex: number; stateKey: string },
    hoverRange: Range
  ): Promise<Hover | null> {
    const root = documentContext.nodeManager.root;
    const stepPath = location.slice(0, stateInfo.stateIndex);
    const innerPath = location.slice(stateInfo.stateIndex + 1);

    if (innerPath.length === 0) return null;

    const toolId = getStringPropertyFromStep(root, stepPath, "tool_id");
    if (!toolId) return null;

    const toolVersion = getStringPropertyFromStep(root, stepPath, "tool_version");
    const rawParams = await this.toolRegistryService!.getToolParameters(toolId, toolVersion);
    if (!rawParams) return null;

    // Build state dict for conditional branch filtering
    const stateNode = getObjectNodeFromStep(root, stepPath, stateInfo.stateKey);
    const stateDict = stateNode ? astObjectNodeToRecord(stateNode) : undefined;

    const result = findParamAtPath(rawParams as ToolParam[], innerPath, stateDict);
    if (!result.param) return null;

    const contents = buildParamHoverMarkdown(result.param);
    return this.createHover(contents, hoverRange);
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
}

