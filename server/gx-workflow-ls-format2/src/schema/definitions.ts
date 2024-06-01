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

export interface IdMapper {
  mapSubject?: string;
  mapPredicate?: string;
}

export interface SchemaField extends DocumentedSchemaEntry {
  default?: unknown;
  jsonldPredicate?: IdMapper;
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
  extends?: string;
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
  itemType: BasicFieldType | BasicFieldType[];
}

interface EnumFieldType extends BasicFieldType {
  symbols: string[];
}

function fieldTypeFactory(typeEntry: unknown): BasicFieldType[] | undefined {
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
      return [arrayType];
    }
    return [buildBasicFieldType(isOptional, baseType)];
  } else if (typeof typeEntry === "object") {
    if (isSchemaArrayType(typeEntry)) {
      const itemType = fieldTypeFactory((typeEntry as SchemaArrayType).items);
      if (itemType) {
        const arrayType: ArrayFieldType = {
          isOptional: false,
          itemType: itemType,
          typeName: "array",
        };
        return [arrayType];
      }
    }
    if (isSchemaEnumType(typeEntry)) {
      const enumType: EnumFieldType = {
        isOptional: false,
        symbols: (typeEntry as SchemaEnumType).symbols,
        typeName: "enum",
      };
      return [enumType];
    }
    if (typeEntry instanceof Array) {
      const types: BasicFieldType[] = [];
      typeEntry.forEach((e) => {
        const res = fieldTypeFactory(e);
        if (res) {
          types.push(...res);
        }
      });
      return types;
    }
    console.debug(`Object Field type UNKNOWN: ${JSON.stringify(typeEntry)} - ${typeof typeEntry}`);
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
  documentation: string | undefined;
  canBeArray: boolean;
  typeRef: string;
  isRoot: boolean;
}

export class EnumSchemaNode implements SchemaNode {
  public static definitions: SchemaDefinitions;

  private readonly _schemaEnum: SchemaEnum;

  constructor(schemaEnum: SchemaEnum) {
    this._schemaEnum = schemaEnum;
  }

  public get name(): string {
    return this._schemaEnum.name;
  }

  public get symbols(): string[] {
    return this._schemaEnum.symbols;
  }

  public get documentation(): string | undefined {
    return this._schemaEnum.doc;
  }

  public get isRoot(): boolean {
    return !!this._schemaEnum.documentRoot;
  }

  public get canBeArray(): boolean {
    return false;
  }

  public get typeRef(): string {
    return this._schemaEnum.name;
  }
}

export class FieldSchemaNode implements SchemaNode, IdMapper {
  public static definitions: SchemaDefinitions;

  private _allowedTypes: BasicFieldType[] = [];
  private readonly _schemaField: SchemaField;

  constructor(schemaField: SchemaField) {
    this._schemaField = schemaField;
    if (schemaField.type instanceof Array) {
      schemaField.type.forEach((typeEntry) => {
        const fieldType = fieldTypeFactory(typeEntry);
        if (fieldType) {
          fieldType.forEach((t) => this._allowedTypes.push(t));
        }
      });
    } else {
      const fieldType = fieldTypeFactory(schemaField.type);
      if (fieldType) {
        fieldType.forEach((t) => this._allowedTypes.push(t));
      }
    }
  }

  public get name(): string {
    return this._schemaField.name;
  }

  public get documentation(): string | undefined {
    return this._schemaField.doc;
  }

  public get isRoot(): boolean {
    return false;
  }

  public get isRequired(): boolean {
    return !this.isOptional;
  }

  public get isOptional(): boolean {
    return this._allowedTypes.some((t) => t.isOptional);
  }

  public get default(): unknown {
    return this._schemaField.default;
  }

  public get canBeAny(): boolean {
    return this._allowedTypes.some((t) => t.typeName === "Any");
  }

  public get canBeArray(): boolean {
    return this.canBeAny || this._allowedTypes.some((t) => isArrayFieldType(t));
  }

  public get canBeObject(): boolean {
    return this.canBeAny || this._allowedTypes.some((t) => this.isObjectType(t.typeName));
  }

  public matchesType(typeName: string): boolean {
    if (this.canBeAny) return true;
    if (typeName === "null" && this.isOptional) return true;
    for (const allowedType of this._allowedTypes) {
      if (allowedType.typeName === typeName) {
        return true;
      }
      if (isArrayFieldType(allowedType)) {
        if (allowedType.itemType instanceof Array) {
          const result = allowedType.itemType.find((t) => t.typeName === typeName);
          if (result) return true;
        } else {
          if (allowedType.itemType.typeName === typeName) {
            return true;
          }
        }
      }
    }
    return false;
  }

  public get typeRef(): string {
    if (this.canBeAny) return "Any";
    if (this.canBeArray) {
      return this.getArrayItemTypeName() || "undefined";
    }
    const mainType = this._allowedTypes.find((t) => t.typeName !== "null");
    //TODO: this requires more logic... we cannot assume the first non-null type to be the main
    return isBasicFieldType(mainType) ? mainType.typeName : "unknown";
  }

  public get mapSubject(): string | undefined {
    return this._schemaField.jsonldPredicate?.mapSubject;
  }

  public get mapPredicate(): string | undefined {
    return this._schemaField.jsonldPredicate?.mapPredicate;
  }

  public getArrayItemTypeName(): string | undefined {
    const arrayType = this._allowedTypes.find((t) => isArrayFieldType(t)) as ArrayFieldType;
    if (isBasicFieldType(arrayType?.itemType)) {
      return arrayType?.itemType.typeName;
    }
    if (arrayType?.itemType instanceof Array) {
      return arrayType.itemType.map((i) => i.typeName).at(0); // TODO REMOVE AT
    }
    console.debug("getArrayItemTypeName -> Type name not found");
    return undefined;
  }

  private isPrimitiveType(typeName: string): boolean {
    return FieldSchemaNode.definitions.primitiveTypes.has(typeName);
  }

  private isObjectType(typeName: string): boolean {
    return FieldSchemaNode.definitions.records.has(typeName);
  }
}

export class RecordSchemaNode implements SchemaNode {
  public static definitions: SchemaDefinitions;
  public static readonly NULL = new RecordSchemaNode({
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
  public get isRoot(): boolean {
    return !!this._schemaRecord.documentRoot;
  }

  public get canBeArray(): boolean {
    return false;
  }

  public get typeRef(): string {
    return this._schemaRecord.name;
  }

  public get typeField(): FieldSchemaNode | undefined {
    return this.getFieldByName("type");
  }

  public matchesTypeField(typeName: string): boolean {
    return this.typeField?.matchesType(typeName) || false;
  }

  public matchesMapping(typeName: string, idMapper?: IdMapper): boolean {
    if (!idMapper || !idMapper.mapSubject) return false;
    const mappedField = this.getFieldByName(idMapper.mapSubject);
    return mappedField?.matchesType(typeName) || false;
  }

  public getFieldByName(name: string): FieldSchemaNode | undefined {
    return this.fields.find((t) => t.name === name);
  }
}

export interface SchemaDefinitions {
  records: Map<string, RecordSchemaNode>;
  enums: Map<string, EnumSchemaNode>;
  specializations: Map<string, string>;
  primitiveTypes: Set<string>;
}
