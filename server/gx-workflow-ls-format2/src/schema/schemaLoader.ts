import {
  isSchemaEntryBase,
  isSchemaRecord,
  SchemaDefinitions,
  SchemaDocument,
  SchemaEntry,
  SchemaEntryBase,
  SchemaEnum,
  SchemaField,
  SchemaRecord,
} from "./definitions";
import { SchemaNodeResolver } from "./schemaNodeResolver";
import { SCHEMA_DOCS_v19_09_MAP } from "./versions";

export class GalaxyWorkflowFormat2SchemaLoader {
  public readonly definitions: SchemaDefinitions;
  private _documentTypeMap = new Map<string, Map<string, SchemaEntry>>();
  private _namespaces = new Map<string, string>();
  public readonly nodeResolver: SchemaNodeResolver;

  private _unknownTypes: string[] = [];
  private _extendedTypes: Set<string> = new Set();
  private _root?: SchemaRecord;
  constructor(private readonly enableDebugTrace: boolean = false) {
    this.definitions = this.loadSchemaDefinitions_v19_09();
    this.nodeResolver = this.createNodeResolver();

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
          if (!this.definitions.types.has(type)) {
            console.debug(`  ${type} ${this.definitions.types.has(type) ? "[found]" : ""}`);
          }
        });
      }
    }
  }

  private loadSchemaDefinitions_v19_09(): SchemaDefinitions {
    const definitions: SchemaDefinitions = {
      types: new Map<string, SchemaEntry>(),
      records: new Map<string, SchemaRecord>(),
      fields: new Map<string, SchemaField>(),
      specializations: new Map<string, string>(),
    };
    SCHEMA_DOCS_v19_09_MAP.forEach((schemaDoc) => {
      const types = this.loadSchemaDocument(schemaDoc);
      types.forEach((v, k) => {
        definitions.types.set(k, v);
        if (isSchemaRecord(v)) {
          definitions.records.set(k, v);
          if (v.specialize) {
            v.specialize.forEach((sp) => {
              definitions.specializations.set(sp.specializeFrom, sp.specializeTo);
            });
          }
          v.fields.forEach((field) => {
            if (definitions.fields.has(field.name)) {
              if (this.enableDebugTrace) console.debug("****** DUPLICATED FIELD", field.name);
            }
            definitions.fields.set(field.name, field);
          });
        }
      });
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
    this._documentTypeMap.set(schemaDoc.$base, documentEntries);
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
    return { name: field.name, type: fieldType, default: field.default, doc: field.doc };
  }

  private resolveTypeName(rawTypeName: string): string {
    const tokens = rawTypeName.split(":");
    if (tokens.length > 1) {
      const namespace = tokens.at(0);
      const type = tokens.at(1);
      if (namespace && type) {
        const docBase = this._namespaces.get(namespace);
        if (docBase) {
          const schemaTypes = this._documentTypeMap.get(docBase);
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
    if (this.definitions.types.has(typeName)) {
      return this.definitions.types.get(typeName) as SchemaEntry;
    }
    throw new Error(`Unresolvable type ${rawTypeName}`);
  }

  private createNodeResolver(): SchemaNodeResolver {
    this.expandRecords();
    return new SchemaNodeResolver(this.definitions, this._root);
  }

  /** Expands all records with the fields defined in the extended types.*/
  private expandRecords(): void {
    this.definitions.types.forEach((value: SchemaEntry) => {
      if (isSchemaRecord(value)) {
        this.expandRecord(value);
      }
    });
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
