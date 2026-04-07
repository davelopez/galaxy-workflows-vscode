import { ASTNode, ArrayASTNode, ObjectASTNode, PropertyASTNode } from "@gxwf/server-common/src/ast/types";
import { ASTNodeManager } from "@gxwf/server-common/src/ast/nodeManager";
import { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { GxFormat2WorkflowDocument } from "../gxFormat2WorkflowDocument";
import {
  ToolParam,
  isConditionalParam,
  isRepeatParam,
  isSelectParam,
  isSectionParam,
} from "./toolStateTypes";

// ---------------------------------------------------------------------------
// State object validation
// ---------------------------------------------------------------------------

function validateStateNode(
  stateNode: ObjectASTNode,
  params: ToolParam[],
  nodeManager: ASTNodeManager,
  result: Diagnostic[]
): void {
  for (const property of stateNode.properties) {
    const paramName = String(property.keyNode.value);
    const match = params.find((p) => p.name === paramName);

    if (!match) {
      result.push({
        message: `Unknown tool parameter '${paramName}'.`,
        range: nodeManager.getNodeRange(property.keyNode),
        severity: DiagnosticSeverity.Warning,
      });
      continue;
    }

    const valueNode = property.valueNode;
    if (!valueNode) continue;

    if (isSectionParam(match)) {
      if (valueNode.type === "object") {
        validateStateNode(valueNode as ObjectASTNode, match.parameters, nodeManager, result);
      }
    } else if (isRepeatParam(match)) {
      if (valueNode.type === "array") {
        for (const item of (valueNode as ArrayASTNode).items) {
          if (item.type === "object") {
            validateStateNode(item as ObjectASTNode, match.parameters, nodeManager, result);
          }
        }
      }
    } else if (isConditionalParam(match)) {
      if (valueNode.type === "object") {
        const allParams: ToolParam[] = [match.test_parameter, ...match.whens.flatMap((w) => w.parameters)];
        validateStateNode(valueNode as ObjectASTNode, allParams, nodeManager, result);
      }
    } else {
      validateLeafValue(match, property, nodeManager, result);
    }
  }
}

function validateLeafValue(
  param: ToolParam,
  property: PropertyASTNode,
  nodeManager: ASTNodeManager,
  result: Diagnostic[]
): void {
  const valueNode = property.valueNode;
  if (!valueNode) return;

  if (isSelectParam(param)) {
    if (valueNode.type === "string") {
      const options = param.options ?? [];
      const allowedValues = options.map((o) => o.value);
      if (allowedValues.length > 0 && !allowedValues.includes(String(valueNode.value))) {
        result.push({
          message: `Invalid value '${valueNode.value}' for '${param.name}'. Must be one of: ${allowedValues.join(", ")}.`,
          range: nodeManager.getNodeRange(valueNode),
          severity: DiagnosticSeverity.Error,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// ToolStateValidationService
// ---------------------------------------------------------------------------

export class ToolStateValidationService {
  constructor(private readonly toolRegistryService: ToolRegistryService) {}

  async doValidation(documentContext: GxFormat2WorkflowDocument): Promise<Diagnostic[]> {
    const result: Diagnostic[] = [];
    const nodeManager = documentContext.nodeManager;
    const stepNodes = nodeManager.getStepNodes();

    for (const stepNode of stepNodes) {
      const toolIdProp = stepNode.properties.find((p) => p.keyNode.value === "tool_id");
      const toolId = toolIdProp?.valueNode?.type === "string" ? String(toolIdProp.valueNode.value) : undefined;
      if (!toolId) continue;

      const toolVersionProp = stepNode.properties.find((p) => p.keyNode.value === "tool_version");
      const toolVersion =
        toolVersionProp?.valueNode?.type === "string" ? String(toolVersionProp.valueNode.value) : undefined;

      const stateProperty =
        stepNode.properties.find((p) => p.keyNode.value === "state") ??
        stepNode.properties.find((p) => p.keyNode.value === "tool_state");

      if (!stateProperty) continue;

      if (!this.toolRegistryService.hasCached(toolId, toolVersion)) {
        // Tool not in cache: info diagnostic on the tool_id value node
        if (toolIdProp?.valueNode) {
          result.push({
            message: `Tool '${toolId}' is not in the local cache. Run 'Populate Tool Cache' to enable tool state validation.`,
            range: nodeManager.getNodeRange(toolIdProp.valueNode),
            severity: DiagnosticSeverity.Information,
          });
        }
        continue;
      }

      // Only validate structured state (object value), not JSON-string tool_state
      const stateValueNode = stateProperty.valueNode;
      if (!stateValueNode || stateValueNode.type !== "object") continue;

      const rawParams = await this.toolRegistryService.getToolParameters(toolId, toolVersion);
      if (!rawParams) continue;

      validateStateNode(stateValueNode as ObjectASTNode, rawParams as ToolParam[], nodeManager, result);
    }

    return result;
  }
}
