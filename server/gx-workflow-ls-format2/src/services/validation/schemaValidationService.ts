import { ASTNodeManager } from "@gxwf/server-common/src/ast/nodeManager";
import { ASTNode, ObjectASTNode } from "@gxwf/server-common/src/ast/types";
import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
  WorkflowDocument,
  WorkflowValidator,
} from "@gxwf/server-common/src/languageTypes";
import { SchemaNode, SchemaNodeResolver } from "../../schema";
import { RecordSchemaNode, IdMapper } from "../../schema/definitions";

export class GxFormat2SchemaValidationService implements WorkflowValidator {
  constructor(protected readonly schemaNodeResolver: SchemaNodeResolver) {}

  public doValidation(workflowDocument: WorkflowDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    this.collectSchemaDiagnostics(workflowDocument, diagnostics);
    return Promise.resolve(diagnostics);
  }

  private collectSchemaDiagnostics(workflowDocument: WorkflowDocument, diagnostics: Diagnostic[]): void {
    if (workflowDocument.nodeManager.root) {
      this.collectDiagnostics(
        workflowDocument.nodeManager,
        workflowDocument.nodeManager.root,
        this.schemaNodeResolver.rootNode,
        diagnostics
      );
    }
  }

  private collectDiagnostics(
    nodeManager: ASTNodeManager,
    node: ASTNode,
    schemaNode: SchemaNode,
    diagnostics: Diagnostic[],
    parenSchemaNode?: SchemaNode
  ): void {
    const range = this.getRange(nodeManager, node);
    if (schemaNode instanceof RecordSchemaNode) {
      switch (node.type) {
        case "object":
          this.validateObjectNode(nodeManager, node, schemaNode, range, diagnostics);
          break;

        default:
          this.validateNodeTypeDefinition(schemaNode, node, range, diagnostics, parenSchemaNode);
          break;
      }
    }
  }

  private validateObjectNode(
    nodeManager: ASTNodeManager,
    node: ObjectASTNode,
    schemaNode: RecordSchemaNode,
    range: Range,
    diagnostics: Diagnostic[]
  ): void {
    schemaNode.fields.forEach((schemaFieldNode) => {
      const propertyNode = node.properties.find((prop) => prop.keyNode.value === schemaFieldNode.name);
      const nodeFound = propertyNode !== undefined;
      if (schemaFieldNode.isRequired && !nodeFound) {
        diagnostics.push(Diagnostic.create(range, `${schemaFieldNode.name} is required`, DiagnosticSeverity.Error));
      }
      if (nodeFound) {
        const childSchemaNode = this.schemaNodeResolver.getSchemaNodeByTypeRef(schemaFieldNode.typeRef);
        if (childSchemaNode && propertyNode.valueNode) {
          if (schemaFieldNode.supportsArray) {
            propertyNode.valueNode.children?.forEach((item) => {
              if (item.type === "property" && item.valueNode) {
                this.collectDiagnostics(nodeManager, item.valueNode, childSchemaNode, diagnostics, schemaFieldNode);
              }
            });
          } else {
            this.collectDiagnostics(nodeManager, propertyNode.valueNode, childSchemaNode, diagnostics, schemaFieldNode);
          }
        }
      }
    });
  }

  private validateNodeTypeDefinition(
    schemaNode: RecordSchemaNode,
    node: ASTNode,
    range: Range,
    diagnostics: Diagnostic[],
    parenSchemaNode?: SchemaNode
  ): void {
    if (!schemaNode.matchesTypeField(node.type) && !schemaNode.matchesMapping(node.type, parenSchemaNode as IdMapper)) {
      diagnostics.push(Diagnostic.create(range, `${schemaNode.name} definition expected`, DiagnosticSeverity.Error));
    }
  }

  private getRange(nodeManager: ASTNodeManager, node: ASTNode): Range {
    if (node === nodeManager.root) {
      const classNode = nodeManager.getNodeFromPath("class") ?? node;
      return nodeManager.getNodeRange(classNode);
    }
    return nodeManager.getNodeRange(node);
  }
}
