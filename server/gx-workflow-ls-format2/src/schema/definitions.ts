import { NodePath } from "@gxwf/server-common/src/ast/types";

export interface SchemaDocument {
  $base: string;
  $namespaces?: object;
  $graph: SchemaEntryBase[];
}

export interface SchemaEntryBase {
  name: string;
  type: string | string[] | unknown;
  documentRoot?: boolean;
}

export interface DocumentedSchemaEntry extends SchemaEntryBase {
  doc?: string;
}

export interface SchemaField extends DocumentedSchemaEntry {
  default?: unknown;
}

export interface SchemaRecord extends DocumentedSchemaEntry {
  fields: SchemaField[];
  extends?: string[];
}

export interface SchemaEnum extends DocumentedSchemaEntry {
  symbols: string[];
}

interface SchemaType {
  type: string;
}

interface SchemaEnumType extends SchemaType {
  symbols: string[];
}

interface SchemaArrayType extends SchemaType {
  items: string;
}

export function isSchemaEntryBase(object: unknown): object is SchemaEntryBase {
  return object instanceof Object && "type" in object;
}

export function isSchemaRecord(object: unknown): object is SchemaRecord {
  return object instanceof Object && "fields" in object;
}

export function isSchemaEnumType(object: unknown): object is SchemaEnumType {
  return object instanceof Object && "symbols" in object;
}

export function isSchemaArrayType(object: unknown): object is SchemaArrayType {
  return object instanceof Object && "items" in object;
}

export function isArrayFieldType(object: unknown): object is ArrayFieldType {
  return object instanceof Object && "itemTypeName" in object;
}

export type SchemaEntry = SchemaEnum | SchemaRecord;

interface FieldType {
  isOptional: boolean;
}

interface BasicFieldType extends FieldType {
  typeName: string;
}

interface ArrayFieldType extends FieldType {
  itemTypeName: string;
}

interface EnumFieldType extends FieldType {
  symbols: string[];
}

function fieldTypeFactory(typeEntry: unknown): FieldType | undefined {
  if (typeof typeEntry === "string") {
    let baseType: string = typeEntry;
    const isOptional = baseType.endsWith("?");
    if (isOptional) {
      baseType = baseType.slice(0, baseType.length - 1);
    }
    const isArray = baseType.endsWith("[]");
    if (isArray) {
      baseType = baseType.slice(0, baseType.length - 2);
      const arrayType: ArrayFieldType = {
        isOptional,
        itemTypeName: baseType,
      };
      return arrayType;
    }
    const basicType: BasicFieldType = {
      isOptional,
      typeName: baseType,
    };
    return basicType;
  }

  if (typeof typeEntry === "object") {
    if (isSchemaArrayType(typeEntry)) {
      const arrayType: ArrayFieldType = {
        isOptional: false,
        itemTypeName: (typeEntry as SchemaArrayType).items,
      };
      return arrayType;
    }
    if (isSchemaEnumType(typeEntry)) {
      const enumType: EnumFieldType = {
        isOptional: false,
        symbols: (typeEntry as SchemaEnumType).symbols,
      };
      return enumType;
    }
    console.debug(`Field type unknown: ${JSON.stringify(typeEntry)}`);
    return undefined;
  }
}

interface SchemaNode {
  name: string;
  children: SchemaNode[];
  documentation: string | undefined;
  supportsArray: boolean;
}

export class Field implements SchemaNode {
  private _allowedTypes: FieldType[] = [];
  private readonly _schemaField: SchemaField;
  constructor(schemaField: SchemaField) {
    this._schemaField = schemaField;
    if (schemaField.type instanceof Array) {
      schemaField.type.forEach((typeEntry) => {
        const fieldType = fieldTypeFactory(typeEntry);
        if (fieldType) {
          this._allowedTypes.push(fieldType);
        }
      });
    } else {
      const fieldType = fieldTypeFactory(schemaField.type);
      if (fieldType) {
        this._allowedTypes.push(fieldType);
      }
    }
  }

  public get name(): string {
    return this._schemaField.name;
  }

  public get documentation(): string | undefined {
    return this._schemaField.doc;
  }

  public get typesAllowed(): FieldType[] {
    return this._allowedTypes;
  }

  public get children(): SchemaNode[] {
    return [];
  }

  public get supportsArray(): boolean {
    return this._allowedTypes.some((t) => isArrayFieldType(t));
  }

  public getArrayItemTypeName(): string | undefined {
    const arrayType = this._allowedTypes.find((t) => isArrayFieldType(t)) as ArrayFieldType;
    return arrayType?.itemTypeName;
  }
}

class SchemaRecordNode implements SchemaNode {
  public static readonly ROOT_NAME: string = "_root_";

  private readonly _schemaRecord: SchemaRecord;
  private readonly _fields: Map<string, Field>;

  constructor(schemaRecord: SchemaRecord) {
    this._schemaRecord = schemaRecord;
    this._fields = new Map<string, Field>();
    schemaRecord.fields.forEach((field) => {
      this._fields.set(field.name, new Field(field));
    });
  }

  public get name(): string {
    return this._schemaRecord.name;
  }

  public get fields(): Field[] {
    return Array.from(this._fields.values());
  }

  public get documentation(): string | undefined {
    return this._schemaRecord.doc;
  }

  public get children(): SchemaNode[] {
    return this.fields;
  }

  public get supportsArray(): boolean {
    return false;
  }
}

export class ResolvedSchema {
  public readonly root?: SchemaNode;
  constructor(public readonly typeMap: Map<string, SchemaEntry>, rootRecord?: SchemaRecord) {
    this.root = rootRecord ? new SchemaRecordNode(rootRecord) : undefined;
  }

  public resolveSchemaContext(path: NodePath): SchemaNode | undefined {
    let currentSchemaNode = this.root;
    const toWalk = path.slice().reverse();
    let next = toWalk.pop();
    while (next) {
      console.debug(`EXPLORING: ${next}`);
      if (typeof next === "string") {
        const child = currentSchemaNode?.children.find((c) => c.name === next);
        if (child) {
          console.debug(`  FIELD FOUND: ${child.name}`);
          currentSchemaNode = child;
        } else {
          console.debug(`  FIELD NOT FOUND: ${next}`);
          if (currentSchemaNode?.supportsArray) {
            const fieldSchemaNode = currentSchemaNode as Field;
            let arrayItemTypeName = fieldSchemaNode.getArrayItemTypeName();
            if (arrayItemTypeName) {
              // For some reason types may start with #
              if (arrayItemTypeName.startsWith("#")) {
                arrayItemTypeName = arrayItemTypeName.slice(1);
              }
              const arrayType = this.typeMap.get(arrayItemTypeName);
              if (isSchemaRecord(arrayType)) {
                currentSchemaNode = new SchemaRecordNode(arrayType as SchemaRecord);
              } else {
                console.debug(`TYPE NOT PROCESSED: ${JSON.stringify(arrayType)}`);
              }
            }
          }
        }
      } else {
        console.debug("NOT A STRING");
      }

      next = toWalk.pop();
    }
    return currentSchemaNode;
  }
}
