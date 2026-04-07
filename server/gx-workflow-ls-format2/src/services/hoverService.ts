import { ASTNode, NodePath, Segment } from "@gxwf/server-common/src/ast/types";
import { Hover, MarkupContent, MarkupKind, Position, Range, ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { GxFormat2WorkflowDocument } from "../gxFormat2WorkflowDocument";
import { SchemaNode, SchemaNodeResolver } from "../schema";
import { findStateInPath } from "./toolStateCompletionService";
import {
  ToolParam,
  ToolParamBase,
  getStringPropertyFromStep,
  isBooleanParam,
  isConditionalParam,
  isRepeatParam,
  isSelectParam,
  isSectionParam,
} from "./toolStateTypes";

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
    stateInfo: { stateIndex: number },
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

    const param = findParamAtPath(rawParams as ToolParam[], innerPath);
    if (!param) return null;

    const contents = buildParamHoverMarkdown(param);
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

// ---------------------------------------------------------------------------
// Parameter lookup and hover markdown
// ---------------------------------------------------------------------------

function findParamAtPath(params: ToolParam[], innerPath: Segment[]): ToolParam | undefined {
  if (innerPath.length === 0) return undefined;
  const head = innerPath[0];
  const tail = innerPath.slice(1);

  if (typeof head === "number") return findParamAtPath(params, tail);

  const match = params.find((p) => p.name === head);
  if (!match) return undefined;
  if (tail.length === 0) return match;

  if (isSectionParam(match)) return findParamAtPath(match.parameters, tail);
  if (isRepeatParam(match)) return findParamAtPath(match.parameters, tail);
  if (isConditionalParam(match)) {
    const allParams: ToolParam[] = [match.test_parameter, ...match.whens.flatMap((w) => w.parameters)];
    return findParamAtPath(allParams, tail);
  }
  return undefined;
}

function buildParamHoverMarkdown(param: ToolParam): string {
  const base = param as ToolParamBase;
  const typeLabel = base.parameter_type.startsWith("gx_") ? base.parameter_type.slice(3) : base.parameter_type;
  const lines: string[] = [];

  lines.push(`**${base.name}** \`${typeLabel}\``);
  if (base.label) lines.push(`_${base.label}_`);
  if (base.help) lines.push(base.help);

  if (isSelectParam(param) && param.options && param.options.length > 0) {
    lines.push("**Options:**");
    for (const opt of param.options) {
      lines.push(`- \`${opt.value}\` — ${opt.label}`);
    }
  } else if (isBooleanParam(param)) {
    lines.push("**Values:** `true` | `false`");
  }

  return lines.join("\n\n");
}
