import { ASTNodeManager } from "@gxwf/server-common/src/ast/nodeManager";
import { ASTNode } from "@gxwf/server-common/src/ast/types";
import { Diagnostic, DiagnosticSeverity, Range, WorkflowDocument } from "@gxwf/server-common/src/languageTypes";
import { SchemaNode, SchemaNodeResolver } from "../schema";
import { RecordSchemaNode, FieldSchemaNode } from "../schema/definitions";

export class GxFormat2SchemaValidationService {
  constructor(protected readonly schemaNodeResolver: SchemaNodeResolver) {}

  public doValidation(workflowDocument: WorkflowDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    if (workflowDocument.nodeManager.root) {
      this.collectDiagnostics(
        workflowDocument.nodeManager,
        workflowDocument.nodeManager.root,
        this.schemaNodeResolver.rootNode,
        diagnostics
      );
    }
    return Promise.resolve(diagnostics);
  }

  private collectDiagnostics(
    nodeManager: ASTNodeManager,
    node: ASTNode,
    schemaNode: SchemaNode,
    diagnostics: Diagnostic[]
  ): void {
    const range = this.getRange(nodeManager, node);
    if (schemaNode instanceof RecordSchemaNode) {
      if (node.type !== "object") {
        if (schemaNode.matchesTypeField(node.type)) {
          return;
        }
        diagnostics.push(Diagnostic.create(range, `${schemaNode.name} definition expected`, DiagnosticSeverity.Error));
      } else {
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
                    this.collectDiagnostics(nodeManager, item.valueNode, childSchemaNode, diagnostics);
                  }
                });
              } else {
                this.collectDiagnostics(nodeManager, propertyNode.valueNode, childSchemaNode, diagnostics);
              }
            }
          }
        });
      }
    } else if (schemaNode instanceof FieldSchemaNode) {
      console.log("Field Schema Node");
    } else {
      console.log("Other Schema Node");
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
