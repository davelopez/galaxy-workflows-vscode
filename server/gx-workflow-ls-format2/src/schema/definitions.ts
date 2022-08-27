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
export interface Specialization {
  specializeFrom: string;
  specializeTo: string;
}

export interface SchemaRecord extends DocumentedSchemaEntry {
  fields: SchemaField[];
  extends?: string[];
  specialize?: Specialization[];
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
  return object instanceof Object && "itemType" in object;
}

export function isBasicFieldType(object: unknown): object is BasicFieldType {
  return object instanceof Object && "typeName" in object;
}

export type SchemaEntry = SchemaEnum | SchemaRecord | SchemaField;

interface FieldTypeBase {
  isOptional: boolean;
}

interface BasicFieldType extends FieldTypeBase {
  typeName: string;
}

interface ArrayFieldType extends BasicFieldType {
  itemType: FieldTypeBase;
}

interface EnumFieldType extends BasicFieldType {
  symbols: string[];
}

function fieldTypeFactory(typeEntry: unknown): BasicFieldType | undefined {
  if (typeof typeEntry === "string") {
    let baseType: string = typeEntry;
    let isOptional = baseType.endsWith("?");
    if (isOptional) {
      baseType = baseType.slice(0, baseType.length - 1);
    }
    isOptional = isOptional || baseType === "null";
    const isArray = baseType.endsWith("[]");
    if (isArray) {
      baseType = baseType.slice(0, baseType.length - 2);
      const arrayType: ArrayFieldType = {
        isOptional,
        itemType: buildBasicFieldType(isOptional, baseType),
        typeName: "array",
      };
      return arrayType;
    }
    return buildBasicFieldType(isOptional, baseType);
  } else if (typeof typeEntry === "object") {
    if (isSchemaArrayType(typeEntry)) {
      const itemType = fieldTypeFactory((typeEntry as SchemaArrayType).items);
      if (itemType) {
        const arrayType: ArrayFieldType = {
          isOptional: false,
          itemType: itemType,
          typeName: "array",
        };
        return arrayType;
      }
    }
    if (isSchemaEnumType(typeEntry)) {
      const enumType: EnumFieldType = {
        isOptional: false,
        symbols: (typeEntry as SchemaEnumType).symbols,
        typeName: "enum",
      };
      return enumType;
    }
    console.debug(`Object Field type UNKNOWN: ${JSON.stringify(typeEntry)}`);
    return undefined;
  } else {
    console.debug(`Field type NOT PROCESSED: ${JSON.stringify(typeEntry)}`);
  }

  function buildBasicFieldType(isOptional: boolean, baseType: string): BasicFieldType {
    return {
      isOptional,
      typeName: baseType.replace("#", ""),
    };
  }
}

export interface SchemaNode {
  name: string;
  children: SchemaNode[];
  documentation: string | undefined;
  supportsArray: boolean;
  typeRef: string;
  isRoot: boolean;
}

export class FieldSchemaNode implements SchemaNode {
  private _allowedTypes: BasicFieldType[] = [];
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

  public get typesAllowed(): BasicFieldType[] {
    return this._allowedTypes;
  }

  public get children(): SchemaNode[] {
    return [];
  }

  public get isRoot(): boolean {
    return false;
  }

  public get isRequired(): boolean {
    return !this.isOptional;
  }

  public get isOptional(): boolean {
    return this._allowedTypes.some((ft) => ft.isOptional);
  }

  public get supportsArray(): boolean {
    return this._allowedTypes.some((t) => isArrayFieldType(t));
  }

  public get typeRef(): string {
    if (this.supportsArray) {
      return this.getArrayItemTypeName() || "undefined";
    }
    const mainType = this.typesAllowed.find((t) => t.typeName !== "null");
    return isBasicFieldType(mainType) ? mainType.typeName : "unknown";
  }

  public getArrayItemTypeName(): string | undefined {
    const arrayType = this._allowedTypes.find((t) => isArrayFieldType(t)) as ArrayFieldType;
    if (isBasicFieldType(arrayType?.itemType)) {
      return arrayType?.itemType.typeName;
    }
    console.debug("getArrayItemTypeName -> Type name not found");
    return undefined;
  }
}

export class RecordSchemaNode implements SchemaNode {
  public static readonly NULL: SchemaNode = new RecordSchemaNode({
    name: "null",
    type: "null",
    fields: [],
    documentRoot: true,
  });

  private readonly _schemaRecord: SchemaRecord;
  private readonly _fields: Map<string, FieldSchemaNode>;

  constructor(schemaRecord: SchemaRecord) {
    this._schemaRecord = schemaRecord;
    this._fields = new Map<string, FieldSchemaNode>();
    schemaRecord.fields.forEach((field) => {
      this._fields.set(field.name, new FieldSchemaNode(field));
    });
  }

  public get name(): string {
    return this._schemaRecord.name;
  }

  public get fields(): FieldSchemaNode[] {
    return Array.from(this._fields.values());
  }

  public get documentation(): string | undefined {
    return this._schemaRecord.doc;
  }

  public get children(): SchemaNode[] {
    return this.fields;
  }

  public get isRoot(): boolean {
    return !!this._schemaRecord.documentRoot;
  }

  public get supportsArray(): boolean {
    return false;
  }

  public get typeRef(): string {
    return this._schemaRecord.name;
  }

  public get typeField(): FieldSchemaNode | undefined {
    return this.fields.find((t) => t.name === "type");
  }

  public matchesTypeField(typeName: string): boolean {
    return this.typeField?.typesAllowed.find((t) => t.typeName === typeName) !== undefined;
  }
}

export interface SchemaDefinitions {
  types: Map<string, SchemaEntry>;
  records: Map<string, SchemaRecord>;
  fields: Map<string, SchemaField>;
  specializations: Map<string, string>;
}
