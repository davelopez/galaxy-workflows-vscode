import { ASTNodeManager } from "@gxwf/server-common/src/ast/nodeManager";
import { ASTNode, ObjectASTNode, PropertyASTNode, StringASTNode } from "@gxwf/server-common/src/ast/types";
import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
  WorkflowDocument,
  WorkflowValidator,
} from "@gxwf/server-common/src/languageTypes";
import { isSimpleType } from "@gxwf/server-common/src/utils";
import { SchemaNode, SchemaNodeResolver } from "../schema";
import { EnumSchemaNode, FieldSchemaNode, IdMapper, RecordSchemaNode } from "../schema/definitions";

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
    const schemaRecord = this.schemaNodeResolver.getSchemaNodeByTypeRef(schemaNode.typeRef);
    if (schemaRecord instanceof EnumSchemaNode) {
      if (node.type === "string") {
        this.validateEnumValue(node, schemaRecord, range, diagnostics);
      } else if (node.type !== "null") {
        diagnostics.push(
          Diagnostic.create(
            range,
            `Type mismatch. Expected '${schemaRecord.name}' but found '${node.type}'.`,
            DiagnosticSeverity.Error
          )
        );
      }
    }
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

  private validateEnumValue(
    node: StringASTNode,
    enumSchemaNode: EnumSchemaNode,
    range: Range,
    diagnostics: Diagnostic[]
  ): void {
    if (!enumSchemaNode.matchesType(node.value)) {
      diagnostics.push(
        Diagnostic.create(
          range,
          `The value is not a valid '${enumSchemaNode.name}'. Allowed values are: ${enumSchemaNode.symbols.join(
            ", "
          )}.`,
          DiagnosticSeverity.Error
        )
      );
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
        diagnostics.push(
          Diagnostic.create(range, `The '${schemaFieldNode.name}' field is required.`, DiagnosticSeverity.Error)
        );
      }
      if (schemaFieldNode.canBeAny) return;
      if (
        nodeFound &&
        propertyNode?.valueNode?.type === "null" &&
        schemaFieldNode.isRequired &&
        !schemaFieldNode.canBeArray
      ) {
        diagnostics.push(
          Diagnostic.create(
            range,
            `Type mismatch for field '${schemaFieldNode.name}'. Expected '${schemaFieldNode.typeRef}' but found 'null'.`,
            DiagnosticSeverity.Error
          )
        );
        return;
      }
      if (nodeFound && propertyNode?.valueNode?.type) {
        const isPropertyTypeSimple = isSimpleType(propertyNode.valueNode.type);
        // Primitive type validation
        if (schemaFieldNode.isPrimitiveType && isPropertyTypeSimple) {
          if (!schemaFieldNode.matchesType(propertyNode.valueNode.type)) {
            diagnostics.push(
              Diagnostic.create(
                range,
                `Type mismatch for field '${schemaFieldNode.name}'. Expected '${schemaFieldNode.typeRef}' but found '${propertyNode.valueNode.type}'.`,
                DiagnosticSeverity.Error
              )
            );
          }
          return;
        }

        // Union type validation
        if (schemaFieldNode.isUnionType) {
          if (isPropertyTypeSimple) {
            const hasMatchingType = this.propetyTypeMatchesAnyPrimitiveRef(schemaFieldNode, propertyNode);
            if (!hasMatchingType) {
              diagnostics.push(
                Diagnostic.create(
                  range,
                  `Type mismatch for field '${schemaFieldNode.name}'. Expected '${schemaFieldNode.typeRefs.join(
                    " | "
                  )}' but found '${propertyNode.valueNode.type}'.`,
                  DiagnosticSeverity.Error
                )
              );
            }
            return;
          }
        }

        const childSchemaNode = this.schemaNodeResolver.getSchemaNodeByTypeRef(schemaFieldNode.typeRef);
        if (childSchemaNode) {
          if (schemaFieldNode.canBeArray) {
            const valueType = propertyNode.valueNode.type;
            if (valueType === "object" && !schemaFieldNode.mapSubject) {
              // Object shorthand with no id-mapping: treat as a single record instance
              this.collectDiagnostics(
                nodeManager,
                propertyNode.valueNode,
                childSchemaNode,
                diagnostics,
                schemaFieldNode
              );
            } else if (valueType === "object" || valueType === "array") {
              // Map or array form: validate each item
              propertyNode.valueNode.children?.forEach((item) => {
                if (item.type === "property" && item.valueNode) {
                  this.collectDiagnostics(nodeManager, item.valueNode, childSchemaNode, diagnostics, schemaFieldNode);
                }
              });
            } else if (!schemaFieldNode.matchesType(propertyNode.valueNode.type)) {
              // Simple scalar not directly accepted by this field: validate against item type
              this.collectDiagnostics(
                nodeManager,
                propertyNode.valueNode,
                childSchemaNode,
                diagnostics,
                schemaFieldNode
              );
            }
          } else {
            this.collectDiagnostics(nodeManager, propertyNode.valueNode, childSchemaNode, diagnostics, schemaFieldNode);
          }
        }
      }
    });
  }

  private propetyTypeMatchesAnyPrimitiveRef(schemaFieldNode: FieldSchemaNode, propertyNode: PropertyASTNode): boolean {
    let matchesSomeType = false;
    const possibleTypes = schemaFieldNode.typeRefs;
    for (const schemaFieldType of possibleTypes) {
      const isPrimitive = this.schemaNodeResolver.definitions.isPrimitiveType(schemaFieldType);
      if (isPrimitive && propertyNode.valueNode && schemaFieldNode.matchesType(propertyNode.valueNode.type)) {
        matchesSomeType = true;
        break;
      }
    }
    return matchesSomeType;
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
