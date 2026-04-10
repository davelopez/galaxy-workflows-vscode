import { findParamAtPath } from "@galaxy-tool-util/schema";
import type { NodePath } from "@gxwf/server-common/src/ast/types";
import { Hover, MarkupContent, MarkupKind, Position, Range } from "@gxwf/server-common/src/languageTypes";
import type { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import {
  astObjectNodeToRecord,
  buildParamHoverMarkdown,
  getObjectNodeFromStep,
  getStringPropertyFromStep,
  ToolParam,
} from "@gxwf/server-common/src/providers/validation/toolStateAstHelpers";
import { findStateInPath, StateInPath } from "@gxwf/server-common/src/providers/toolStateCompletion";
import {
  LanguageService as JSONLanguageService,
} from "vscode-json-languageservice";
import { NativeWorkflowDocument } from "../nativeWorkflowDocument";

export class NativeHoverService {
  constructor(
    private readonly toolRegistryService: ToolRegistryService,
    private readonly jsonLanguageService?: JSONLanguageService
  ) {}

  public async doHover(doc: NativeWorkflowDocument, position: Position): Promise<Hover | null> {
    const textDocument = doc.textDocument;
    const nodeManager = doc.nodeManager;
    const offset = textDocument.offsetAt(position);
    let node = nodeManager.getNodeFromOffset(offset);

    if (
      !node ||
      ((node.type === "object" || node.type === "array") &&
        offset > node.offset + 1 &&
        offset < node.offset + node.length - 1)
    ) {
      return this.jsonFallback(doc, position);
    }

    const hoverRangeNode = node;

    // When hovering over a property key, navigate to the value node
    // (same logic as format2 hoverService)
    if (node.type === "string") {
      const parent = node.parent;
      if (parent && parent.type === "property" && parent.keyNode === node) {
        node = parent.valueNode;
        if (!node) {
          return this.jsonFallback(doc, position);
        }
      }
    }

    const hoverRange = nodeManager.getNodeRange(hoverRangeNode);
    const location = nodeManager.getPathFromNode(hoverRangeNode);

    // Check if cursor is inside a step's tool_state block (object-form only)
    const stateInfo = findStateInPath(location);
    if (stateInfo) {
      const stepPath = location.slice(0, stateInfo.stateIndex);
      const stateNode = getObjectNodeFromStep(nodeManager.root, stepPath, stateInfo.stateKey);
      if (stateNode) {
        const stateHover = await this.getToolStateHover(doc, location, stateInfo, hoverRange);
        if (stateHover) return stateHover;
      }
    }

    return this.jsonFallback(doc, position);
  }

  private async getToolStateHover(
    doc: NativeWorkflowDocument,
    location: NodePath,
    stateInfo: StateInPath,
    hoverRange: Range
  ): Promise<Hover | null> {
    const root = doc.nodeManager.root;
    const stepPath = location.slice(0, stateInfo.stateIndex);
    const innerPath = location.slice(stateInfo.stateIndex + 1);

    if (innerPath.length === 0) return null;

    const toolId = getStringPropertyFromStep(root, stepPath, "tool_id");
    if (!toolId) return null;

    const toolVersion = getStringPropertyFromStep(root, stepPath, "tool_version");
    const rawParams = await this.toolRegistryService.getToolParameters(toolId, toolVersion);
    if (!rawParams) return null;

    const stateNode = getObjectNodeFromStep(root, stepPath, stateInfo.stateKey);
    const stateDict = stateNode ? astObjectNodeToRecord(stateNode) : undefined;

    const result = findParamAtPath(rawParams as ToolParam[], innerPath, stateDict);
    if (!result.param) return null;

    const contents = buildParamHoverMarkdown(result.param);
    return this.createHover(contents, hoverRange);
  }

  private createHover(contents: string, hoverRange: Range): Hover {
    const markupContent: MarkupContent = {
      kind: MarkupKind.Markdown,
      value: contents,
    };
    return { contents: markupContent, range: hoverRange };
  }

  private jsonFallback(doc: NativeWorkflowDocument, position: Position): Promise<Hover | null> {
    if (this.jsonLanguageService) {
      return this.jsonLanguageService.doHover(doc.textDocument, position, doc.jsonDocument);
    }
    return Promise.resolve(null);
  }
}
