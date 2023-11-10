import { NodePath, Segment } from "@gxwf/server-common/src/ast/types";
import { RecordSchemaNode, SchemaDefinitions, SchemaNode, SchemaRecord } from "./definitions";

export interface SchemaNodeResolver {
  rootNode: SchemaNode;
  definitions: SchemaDefinitions;
  resolveSchemaContext(path: NodePath): SchemaNode | undefined;
  getSchemaNodeByTypeRef(typeRef: string): SchemaNode | undefined;
}

export class SchemaNodeResolverImpl implements SchemaNodeResolver {
  public readonly rootNode: SchemaNode;
  constructor(
    public readonly definitions: SchemaDefinitions,
    root?: SchemaRecord
  ) {
    this.rootNode = root ? new RecordSchemaNode(root) : RecordSchemaNode.NULL;
  }

  public resolveSchemaContext(path: NodePath): SchemaNode | undefined {
    const toWalk = path.slice();
    const lastSegment = toWalk.pop();
    const schemaNodeFound = this.getSchemaNodeForSegment(lastSegment);
    while (toWalk.length && !schemaNodeFound) {
      const parentSegment = toWalk.pop();
      const parentNode = this.getSchemaNodeForSegment(parentSegment);
      if (parentNode) {
        return this.getSchemaNodeForSegment(parentNode.typeRef);
      }
    }
    return schemaNodeFound;
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
      return this.definitions.fields.get(pathSegment);
    }
    return undefined;
  }
}
