import { NodePath, Segment } from "@gxwf/server-common/src/ast/types";
import { FieldSchemaNode, RecordSchemaNode, SchemaDefinitions, SchemaNode, SchemaRecord } from "./definitions";

export interface SchemaNodeResolver {
  rootNode: SchemaNode;
  definitions: SchemaDefinitions;
  resolveSchemaContext(path: NodePath): SchemaNode | undefined;
  getSchemaNodeByTypeRef(typeRef: string): SchemaNode | undefined;
}

export class SchemaNodeResolverImpl implements SchemaNodeResolver {
  public readonly rootNode: RecordSchemaNode;
  constructor(
    public readonly definitions: SchemaDefinitions,
    root?: SchemaRecord
  ) {
    this.rootNode = root ? new RecordSchemaNode(root) : RecordSchemaNode.NULL;
  }

  /**
   * Determines the matching schema node for the last segment in the path.
   * @param path The path to resolve from root to leaf
   * @returns The matching schema node for the last segment in the path or undefined
   * if the path does not match any schema node.
   */
  public resolveSchemaContext(path: NodePath): SchemaNode | undefined {
    const toWalk = path.slice();
    let currentSegment = toWalk.shift();
    let currentSchemaNode: SchemaNode | undefined = this.rootNode;

    while (currentSegment !== undefined) {
      if (currentSchemaNode instanceof RecordSchemaNode) {
        currentSchemaNode = currentSchemaNode.fields.find((f) => f.name === currentSegment);
      } else if (currentSchemaNode instanceof FieldSchemaNode) {
        const typeNode = this.getSchemaNodeByTypeRef(currentSchemaNode.typeRef);
        currentSchemaNode = typeNode;
      }
      currentSegment = toWalk.shift();
    }
    return currentSchemaNode;
  }

  public getSchemaNodeByTypeRef(typeRef: string): SchemaNode | undefined {
    return this.getSchemaNodeForSegment(typeRef);
  }

  private getSchemaNodeForSegment(pathSegment?: Segment): SchemaNode | undefined {
    if (typeof pathSegment === "string") {
      pathSegment = this.definitions.specializations.get(pathSegment) || pathSegment;
      if (this.definitions.records.has(pathSegment)) {
        return this.definitions.records.get(pathSegment);
      }
      return this.definitions.enums.get(pathSegment);
    }
    return undefined;
  }
}
