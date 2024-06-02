import {
  EnumSchemaNode,
  FieldSchemaNode,
  isSchemaEntryBase,
  isSchemaEnumType,
  isSchemaRecord,
  RecordSchemaNode,
  SchemaDefinitions,
  SchemaDocument,
  SchemaEntry,
  SchemaEntryBase,
  SchemaEnum,
  SchemaField,
  SchemaRecord,
} from "./definitions";
import { SchemaNodeResolver, SchemaNodeResolverImpl } from "./schemaNodeResolver";
import { SCHEMA_DOCS_v19_09_MAP } from "./versions";

export interface GalaxyWorkflowSchemaLoader {
  readonly definitions: SchemaDefinitions;
  readonly nodeResolver: SchemaNodeResolver;
}

export class GalaxyWorkflowFormat2SchemaLoader implements GalaxyWorkflowSchemaLoader {
  private _documentEntryMap = new Map<string, Map<string, SchemaEntry>>();
  private _rawSchemaEntries = new Map<string, SchemaEntry>();
  private _namespaces = new Map<string, string>();
  private _unknownTypes: string[] = [];
  private _extendedTypes: Set<string> = new Set();
  private _root?: SchemaRecord;
  public readonly definitions: SchemaDefinitions;
  public readonly nodeResolver: SchemaNodeResolver;

  constructor(private readonly enableDebugTrace: boolean = false) {
    this._rawSchemaEntries = this.loadSchemaEntriesMap_v19_09();
    this.definitions = this.loadSchemaDefinitions(this._rawSchemaEntries);
    this.nodeResolver = this.createNodeResolver();
    RecordSchemaNode.definitions = this.definitions;
    FieldSchemaNode.definitions = this.definitions;

    if (this.enableDebugTrace) {
      if (this._unknownTypes) {
        console.debug(`UNKNOWN Types: ${this._unknownTypes.length}`);
        this._unknownTypes.forEach((t) => {
          console.debug(`  ${t}`);
        });
      }

      if (this._extendedTypes) {
        console.debug(`EXTENDED Types (Unresolved): ${this._extendedTypes.size}`);
        this._extendedTypes.forEach((type) => {
          if (!this._rawSchemaEntries.has(type)) {
            console.debug(`  ${type} ${this._rawSchemaEntries.has(type) ? "[found]" : ""}`);
          }
        });
      }
    }
  }

  private loadSchemaEntriesMap_v19_09(): Map<string, SchemaEntry> {
    const entries = new Map<string, SchemaEntry>();
    for (const schemaDoc of SCHEMA_DOCS_v19_09_MAP.values()) {
      const types = this.loadSchemaDocument(schemaDoc);
      types.forEach((v, k) => {
        entries.set(k, v);
      });
    }
    return entries;
  }

  private loadSchemaDefinitions(schemaEntries: Map<string, SchemaEntry>): SchemaDefinitions {
    const definitions: SchemaDefinitions = {
      records: new Map<string, RecordSchemaNode>(),
      enums: new Map<string, EnumSchemaNode>(),
      specializations: new Map<string, string>(),
      primitiveTypes: new Set<string>(),
    };

    this.expandEntries(schemaEntries.values());
    schemaEntries.forEach((v, k) => {
      if (isSchemaRecord(v)) {
        const record = new RecordSchemaNode(v);
        definitions.records.set(k, record);
        if (v.specialize) {
          v.specialize.forEach((sp) => {
            definitions.specializations.set(sp.specializeFrom, sp.specializeTo);
          });
        }
      } else if (isSchemaEnumType(v)) {
        definitions.enums.set(k, new EnumSchemaNode(v));
        if (v.name === "GalaxyType") {
          definitions.primitiveTypes = new Set(v.symbols);
        }
      }
    });
    return definitions;
  }

  private loadSchemaDocument(schemaDoc: SchemaDocument): Map<string, SchemaEntry> {
    if (this.enableDebugTrace) console.debug(`Loading schema doc: ${schemaDoc.$base}`);
    this.registerDocumentNamespaces(schemaDoc);
    const documentEntries = new Map<string, SchemaEntry>();
    schemaDoc.$graph.forEach((entry: SchemaEntryBase) => {
      let loadedEntry: SchemaEntry | undefined;
      if (entry.type == "enum") {
        loadedEntry = this.loadEnum(entry as SchemaEnum);
      } else if (entry.type == "record") {
        const recordEntry = this.loadRecord(entry as SchemaRecord);
        if (entry.documentRoot) {
          this._root = recordEntry;
        }
        loadedEntry = recordEntry;
      } else {
        this._unknownTypes.push(entry.type as string);
      }
      if (loadedEntry) {
        documentEntries.set(entry.name, loadedEntry);
      }
    });
    this._documentEntryMap.set(schemaDoc.$base, documentEntries);
    return documentEntries;
  }

  private registerDocumentNamespaces(schemaDoc: SchemaDocument): void {
    if (schemaDoc.$namespaces) {
      Object.entries(schemaDoc.$namespaces).forEach(([k, v]) => {
        this._namespaces.set(k, v);
      });
    }
  }

  private loadEnum(entry: SchemaEnum): SchemaEnum {
    if (this.enableDebugTrace) console.debug(`Enum: ${entry.name} ${"abstract" in entry ? "[abstract]" : ""}`);
    const enumEntry: SchemaEnum = {
      name: entry.name,
      type: entry.type,
      doc: entry.doc,
      symbols: entry.symbols,
      extends: entry.extends,
    };

    return enumEntry;
  }

  private loadRecord(entry: SchemaRecord): SchemaRecord {
    if (this.enableDebugTrace)
      console.debug(
        `Record: ${entry.name} ${"abstract" in entry ? "[abstract]" : ""} ${"extends" in entry ? "[extends]" : ""}`
      );
    const fields = this.readEntryFields(entry);

    const recordEntry: SchemaRecord = {
      name: entry.name,
      type: entry.type,
      doc: entry.doc,
      fields: fields,
      extends: entry.extends ? (entry.extends instanceof Array ? [...entry.extends] : [entry.extends]) : [],
      specialize: entry.specialize,
    };

    if (recordEntry.extends) {
      if (recordEntry.extends instanceof Array) {
        recordEntry.extends.forEach((type) => {
          this._extendedTypes.add(type);
        });
      } else {
        this._extendedTypes.add(recordEntry.extends);
      }
    }

    if (recordEntry.specialize) {
      recordEntry.specialize.forEach((sp) => {
        sp.specializeFrom = this.resolveTypeName(sp.specializeFrom);
        sp.specializeTo = this.resolveTypeName(sp.specializeTo);
      });
    }

    return recordEntry;
  }

  private readEntryFields(entry: SchemaRecord): SchemaField[] {
    const fields: SchemaField[] = [];
    if (entry.fields instanceof Array) {
      entry.fields.forEach((field) => {
        fields.push(this.loadField(field));
      });
    } else {
      // Is an Object
      if (entry.fields) {
        Object.entries(entry.fields).forEach(([key, value]) => {
          if (isSchemaEntryBase(value)) {
            fields.push({ name: key, type: value.type });
          }
        });
      } else {
        if (this.enableDebugTrace) console.debug("------- NO FIELDS");
      }
    }
    // if (fields) {
    //   fields.forEach((field) => {
    //     console.debug(`  ${field.name}: ${field.type}`);
    //   });
    // }
    return fields;
  }

  private loadField(field: SchemaField): SchemaField {
    let fieldType = field.type;

    if (typeof fieldType === "string") {
      fieldType = this.resolveTypeName(fieldType as string);
    } else {
      if (this.enableDebugTrace)
        console.debug(`  --Field type NOT string: ${JSON.stringify(fieldType)} -> ${typeof fieldType}`);
    }
    return {
      name: field.name,
      type: fieldType,
      default: field.default,
      doc: field.doc,
      jsonldPredicate: field.jsonldPredicate,
      documentRoot: field.documentRoot,
    };
  }

  private resolveTypeName(rawTypeName: string): string {
    const tokens = rawTypeName.split(":");
    if (tokens.length > 1) {
      const namespace = tokens.at(0);
      const type = tokens.at(1);
      if (namespace && type) {
        const docBase = this._namespaces.get(namespace);
        if (docBase) {
          const schemaTypes = this._documentEntryMap.get(docBase);
          if (schemaTypes?.has(type)) {
            rawTypeName = type;
          } else {
            if (this.enableDebugTrace) console.debug(`Type ${type} not found in namespace ${namespace}.`);
          }
        } else {
          if (this.enableDebugTrace) console.debug(`Namespace ${namespace} not found.`);
        }
      }
    }
    return rawTypeName;
  }

  private resolveTypeToSchemaEntry(rawTypeName: string): SchemaEntry {
    const typeName = this.resolveTypeName(rawTypeName);
    if (this._rawSchemaEntries.has(typeName)) {
      return this._rawSchemaEntries.get(typeName) as SchemaEntry;
    }
    throw new Error(`Unresolvable type ${rawTypeName}`);
  }

  private createNodeResolver(): SchemaNodeResolver {
    return new SchemaNodeResolverImpl(this.definitions, this._root);
  }

  /** Expands all entries with the types defined in the extended types.*/
  private expandEntries(schemaEntries: IterableIterator<SchemaEntry>): void {
    for (const entry of schemaEntries) {
      if (isSchemaRecord(entry)) {
        this.expandRecord(entry);
      } else if (isSchemaEnumType(entry)) {
        this.expandEnum(entry);
      }
    }
  }

  private expandRecord(record: SchemaRecord): SchemaRecord {
    if (!record.extends) {
      return record;
    }
    const extensionFields = this.collectExtensionFields(record, []);
    record.fields.push(...extensionFields);
    record.extends = [];
    return record;
  }

  private expandEnum(entry: SchemaEnum): SchemaEnum {
    if (!entry.extends) {
      return entry;
    }
    const resolved = this.resolveTypeToSchemaEntry(entry.extends);
    if (isSchemaEnumType(resolved)) {
      resolved.symbols.forEach((s) => {
        const symbol = s.indexOf(":") > 0 ? (s.split(":").at(1) as string) : s;
        entry.symbols.push(symbol);
      });
    }
    entry.extends = undefined;
    return entry;
  }

  private collectExtensionFields(record: SchemaRecord, extensionFields: SchemaField[]): SchemaField[] {
    record.extends?.forEach((typeToExtend) => {
      const resolved = this.resolveTypeToSchemaEntry(typeToExtend);
      if (isSchemaRecord(resolved)) {
        extensionFields.push(...resolved.fields);
        return this.collectExtensionFields(resolved, extensionFields);
      }
    });
    return extensionFields;
  }
}
