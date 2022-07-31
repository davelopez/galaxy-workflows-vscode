import { NodePath, Segment } from "@gxwf/server-common/src/ast/types";
import { SchemaDefinitions, SchemaNode, RecordSchemaNode, FieldSchemaNode, SchemaRecord } from "./definitions";

export class SchemaNodeResolver {
  public readonly rootNode: SchemaNode;
  constructor(public readonly definitions: SchemaDefinitions, root?: SchemaRecord) {
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

  private getSchemaNodeForSegment(pathSegment?: Segment): SchemaNode | undefined {
    if (typeof pathSegment === "string") {
      if (this.definitions.records.has(pathSegment)) {
        const record = this.definitions.records.get(pathSegment);
        if (record) return new RecordSchemaNode(record);
      }
      if (this.definitions.fields.has(pathSegment)) {
        const field = this.definitions.fields.get(pathSegment);
        if (field) return new FieldSchemaNode(field);
      }
    }
    return undefined;
  }
}
