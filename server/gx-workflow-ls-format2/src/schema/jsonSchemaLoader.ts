import { GalaxyWorkflowSchema } from "@galaxy-tool-util/schema";
import { JSONSchema as EffectJSONSchema } from "effect";
import {
  EnumSchemaNode,
  FieldSchemaNode,
  RecordSchemaNode,
  SchemaDefinitions,
  SchemaEnum,
  SchemaField,
  SchemaRecord,
} from "./definitions";
import { SchemaNodeResolver, SchemaNodeResolverImpl } from "./schemaNodeResolver";

export interface GalaxyWorkflowSchemaLoader {
  readonly definitions: SchemaDefinitions;
  readonly nodeResolver: SchemaNodeResolver;
}

/** Minimal JSON Schema shape as produced by Effect's JSONSchema.make */
type JSchema = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers for navigating Effect-generated JSON Schema
// ---------------------------------------------------------------------------

function anyOf(s: JSchema): JSchema[] | undefined {
  return s.anyOf as JSchema[] | undefined;
}

/** Return non-null alternatives from anyOf, or [s] when there is no anyOf. */
function nonNullAlts(s: JSchema): JSchema[] {
  const alts = anyOf(s);
  if (!alts) return [s];
  return alts.filter((a) => (a as JSchema).type !== "null");
}

function isArraySchema(s: JSchema): boolean {
  return s.type === "array";
}

function isEnumSchema(s: JSchema): boolean {
  return Array.isArray(s.enum);
}

function getArrayItemSchema(s: JSchema): JSchema {
  if (isArraySchema(s)) return (s.items as JSchema) ?? {};
  const arr = anyOf(s)?.find((a) => isArraySchema(a as JSchema));
  if (arr) return ((arr as JSchema).items as JSchema) ?? {};
  return {};
}

/** Extract enum symbols from a JSON Schema, looking through anyOf wrappers. */
function extractEnumSymbols(schema: JSchema): string[] {
  if (isEnumSchema(schema)) return schema.enum as string[];
  for (const alt of nonNullAlts(schema)) {
    if (isEnumSchema(alt as JSchema)) return (alt as JSchema).enum as string[];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Field type builders producing SchemaField.type values that fieldTypeFactory
// can parse into the existing FieldSchemaNode machinery.
//
// Key patterns:
//   "string?"                                → optional string
//   ["null", "string", {type:"array",...}]   → optional string-or-array (doc field)
//   ["null", {type:"array",...}]             → optional array
//   [{type:"array", items:"T"}]              → required array of T (canBeArray=true)
//   ["null", "T"]                            → optional named type
// ---------------------------------------------------------------------------

function optStringField(name: string, doc?: string): SchemaField {
  return { name, type: "string?", doc };
}

function reqStringField(name: string, doc?: string): SchemaField {
  return { name, type: "string", doc };
}

/** Optional field that can also be an array of strings (e.g. `doc`). */
function optStringOrArrayField(name: string, doc?: string): SchemaField {
  return { name, type: ["null", "string", { type: "array", items: "string" }], doc };
}

/** Optional array-of-strings field. */
function optStringArrayField(name: string, doc?: string): SchemaField {
  return { name, type: ["null", { type: "array", items: "string" }], doc };
}

/** Required array with a named item type. canBeArray=true, typeRef=itemType. */
function _namedArrayField(name: string, itemType: string, doc?: string): SchemaField {
  return { name, type: [{ type: "array", items: itemType }], doc };
}

/** Optional array with a named item type. isOptional=true, canBeArray=true. */
function _optNamedArrayField(name: string, itemType: string, doc?: string): SchemaField {
  return { name, type: ["null", { type: "array", items: itemType }], doc };
}

/** Optional named-record field. isOptional=true, canBeObject=true. */
function optNamedField(name: string, typeName: string, doc?: string): SchemaField {
  return { name, type: ["null", typeName], doc };
}

/** Field typed as "Any" (optional, matches everything). */
function anyField(name: string, doc?: string): SchemaField {
  return { name, type: "Any?", doc };
}

// ---------------------------------------------------------------------------
// Build SchemaRecord objects from our knowledge of the GalaxyWorkflow structure
// ---------------------------------------------------------------------------

function buildGalaxyWorkflowRecord(): SchemaRecord {
  const fields: SchemaField[] = [
    // Required discriminator — type is the GalaxyWorkflowClass enum
    { name: "class", type: "GalaxyWorkflowClass", doc: "Must be 'GalaxyWorkflow'.", default: "GalaxyWorkflow" },
    // inputs/outputs/steps use abstract names so ignoredSchemaRefs in CompletionService
    // suppresses completions at the key-definition level (e.g. `inputs:\n  $`).
    // jsonldPredicate tells the validator these are id-maps (key = entry id).
    {
      name: "inputs",
      type: [{ type: "array", items: "InputParameter" }],
      doc: "Workflow input parameters.",
      jsonldPredicate: { mapSubject: "id" },
    },
    {
      name: "outputs",
      type: [{ type: "array", items: "OutputParameter" }],
      doc: "Workflow output parameters.",
      jsonldPredicate: { mapSubject: "id" },
    },
    {
      name: "steps",
      type: [{ type: "array", items: "WorkflowStep" }],
      doc: "The individual steps that make up the workflow.",
      jsonldPredicate: { mapSubject: "id" },
    },
    optNamedField("report", "Report", "Workflow invocation report template."),
    optStringArrayField("tags", "Tags for the workflow."),
    { name: "creator", type: "Any?", doc: "Workflow creators (Person or Organization)." },
    optStringField("license", "Must be a valid license listed at https://spdx.org/licenses/"),
    optStringField("release", "Release of the workflow in its source repository."),
    optStringField("id", "Unique identifier for this object."),
    optStringField("label", "Short human-readable label of this object."),
    optStringOrArrayField("doc", "Documentation string for this object."),
    optStringField("uuid", "UUID uniquely representing this element."),
    { name: "comments", type: "Any?", doc: "Visual annotations for the workflow editor canvas." },
  ];

  return {
    name: "GalaxyWorkflow",
    type: "record",
    doc: "A Galaxy workflow description (gxformat2 YAML).",
    fields,
    extends: [],
    documentRoot: true,
  } as SchemaRecord & { documentRoot: boolean };
}

function buildWorkflowInputParameterRecord(): SchemaRecord {
  const fields: SchemaField[] = [
    {
      name: "type",
      type: ["null", "GalaxyType", { type: "array", items: "GalaxyType" }],
      doc: "Specify valid types of data.",
      default: "data",
    },
    optNamedField("optional", "boolean", "If true, parameter is not required to submit the workflow."),
    optStringArrayField("format", "Specify datatype extension for valid input datasets."),
    optStringField("collection_type", "Collection type."),
    anyField("default", "Default value for this parameter."),
    optStringField("label", "Short human-readable label of this object."),
    optStringOrArrayField("doc", "Documentation string for this object."),
    optStringField("id", "Unique identifier for this object."),
    optNamedField("position", "StepPosition", "Position of the step node in the editor."),
  ];

  return {
    name: "WorkflowInputParameter",
    type: "record",
    doc: "A workflow input parameter.",
    fields,
    extends: [],
  };
}

function buildWorkflowOutputParameterRecord(): SchemaRecord {
  const fields: SchemaField[] = [
    optStringField("outputSource", "Specifies workflow parameter that supplies the value of this output."),
    optNamedField("type", "GalaxyType", "Specify valid types of data that may be assigned to this parameter."),
    optStringField("label", "Short human-readable label of this object."),
    optStringOrArrayField("doc", "Documentation string for this object."),
    optStringField("id", "Unique identifier for this object."),
  ];

  return {
    name: "WorkflowOutputParameter",
    type: "record",
    doc: "A workflow output parameter.",
    fields,
    extends: [],
  };
}

function buildWorkflowStepRecord(): SchemaRecord {
  const fields: SchemaField[] = [
    optStringField("id", "Unique identifier for this object."),
    optStringField("label", "Short human-readable label of this object."),
    optStringOrArrayField("doc", "Documentation string for this object."),
    optNamedField("position", "StepPosition", "Location of the step's node in the editor."),
    // ReferencesTool
    optStringField("tool_id", "The tool ID used to run this step."),
    optNamedField("tool_shed_repository", "ToolShedRepository", "The ToolShed repository for this tool."),
    optStringField("tool_version", "The tool version used to run this step."),
    // HasStepErrors
    optStringField("errors", "Error description from Galaxy export."),
    // HasUUID
    optStringField("uuid", "UUID uniquely representing this element."),
    // in: optional array/map of WorkflowStepInput; gxformat2 uses "id: source" shorthand
    {
      name: "in",
      type: ["null", { type: "array", items: "WorkflowStepInput" }],
      doc: "Workflow step input connections.",
      jsonldPredicate: { mapSubject: "id", mapPredicate: "source" },
    },
    // out: optional array that can be WorkflowStepOutput or string
    {
      name: "out",
      type: ["null", { type: "array", items: "WorkflowStepOutput" }, { type: "array", items: "string" }],
      doc: "Workflow step outputs.",
    },
    // state / tool_state → Any
    anyField("state", "Structured tool state."),
    anyField("tool_state", "Unstructured tool state (JSON-encoded string or map)."),
    // type enum — optional, default "tool"
    { name: "type", type: ["null", "WorkflowStepType"], doc: "Module type (defaults to 'tool').", default: "tool" },
    // run → optional GalaxyWorkflow (recursive)
    optNamedField("run", "GalaxyWorkflow", "Specifies a subworkflow to run."),
    optStringArrayField("runtime_inputs", "Parameters determined at runtime."),
    optStringField("when", "Conditional expression; step is skipped when false."),
  ];

  return {
    name: "WorkflowStep",
    type: "record",
    doc: "A non-input step in a Galaxy Workflow.",
    fields,
    extends: [],
  };
}

function buildWorkflowStepInputRecord(): SchemaRecord {
  const fields: SchemaField[] = [
    optStringField("id", "Unique identifier for this object."),
    {
      name: "source",
      type: ["null", "string", { type: "array", items: "string" }],
      doc: "Upstream step or input providing the value.",
    },
    optStringField("label", "Short label."),
    anyField("default", "Default value if source is absent or null."),
  ];
  return {
    name: "WorkflowStepInput",
    type: "record",
    doc: "A workflow step input connection.",
    fields,
    extends: [],
  };
}

function buildWorkflowStepOutputRecord(): SchemaRecord {
  const fields: SchemaField[] = [
    optStringField("id", "Unique identifier for this object."),
    optStringArrayField("add_tags"),
    optStringField("change_datatype"),
    optNamedField("delete_intermediate_datasets", "boolean"),
    optNamedField("hide", "boolean"),
    optStringArrayField("remove_tags"),
    optStringField("rename"),
    anyField("set_columns"),
  ];
  return {
    name: "WorkflowStepOutput",
    type: "record",
    doc: "A workflow step output.",
    fields,
    extends: [],
  };
}

function buildStepPositionRecord(): SchemaRecord {
  const fields: SchemaField[] = [
    { name: "top", type: "float", doc: "Relative vertical position." },
    { name: "left", type: "float", doc: "Relative horizontal position." },
  ];
  return {
    name: "StepPosition",
    type: "record",
    doc: "Location of a step node in the workflow editor.",
    fields,
    extends: [],
  };
}

function buildReportRecord(): SchemaRecord {
  const fields: SchemaField[] = [
    reqStringField("markdown", "Galaxy flavored Markdown to define the invocation report."),
  ];
  return {
    name: "Report",
    type: "record",
    doc: "Definition of an invocation report for this workflow.",
    fields,
    extends: [],
  };
}

function buildToolShedRepositoryRecord(): SchemaRecord {
  const fields: SchemaField[] = [
    reqStringField("name", "Name of the tool shed repository."),
    reqStringField("changeset_revision", "Revision of the tool shed repository."),
    reqStringField("owner", "Owner of the tool shed repository."),
    reqStringField("tool_shed", "URI of the tool shed (e.g. toolshed.g2.bx.psu.edu)."),
  ];
  return {
    name: "ToolShedRepository",
    type: "record",
    doc: "A Tool Shed repository reference.",
    fields,
    extends: [],
  };
}

// ---------------------------------------------------------------------------
// Enum builders
// ---------------------------------------------------------------------------

function buildGalaxyWorkflowClassEnum(): SchemaEnum {
  return {
    name: "GalaxyWorkflowClass",
    type: "enum",
    doc: "Discriminator class for GalaxyWorkflow documents.",
    symbols: ["GalaxyWorkflow"],
  };
}

function buildAnyEnum(): SchemaEnum {
  // "Any" is represented as a special enum so EnumSchemaNode.canBeAny returns true.
  return { name: "Any", type: "enum", doc: "Any type.", symbols: [] };
}

// ---------------------------------------------------------------------------
// Build full SchemaDefinitions
// ---------------------------------------------------------------------------

function buildDefinitions(rootJsonSchema: JSchema): {
  rawRecords: Map<string, SchemaRecord>;
  records: Map<string, RecordSchemaNode>;
  enums: Map<string, EnumSchemaNode>;
  specializations: Map<string, string>;
} {
  const defs = (rootJsonSchema.$defs ?? {}) as Record<string, JSchema>;
  const stepSchema = defs["WorkflowStepSchema"] ?? {};
  const stepProps = (stepSchema.properties ?? {}) as Record<string, JSchema>;
  const rootProps = (rootJsonSchema.properties ?? {}) as Record<string, JSchema>;

  // Extract GalaxyType enum symbols from JSON Schema (inputs.type property)
  const inputArraySchema = getArrayItemSchema(rootProps["inputs"] ?? {});
  const inputProps = (inputArraySchema.properties ?? {}) as Record<string, JSchema>;
  const galaxyTypeSymbols = extractEnumSymbols(inputProps["type"] ?? {});

  // Extract WorkflowStepType symbols from JSON Schema
  const stepTypeSymbols = extractEnumSymbols(stepProps["type"] ?? {});

  // Build SchemaRecord objects
  const rawRecordList: SchemaRecord[] = [
    buildGalaxyWorkflowRecord(),
    buildWorkflowInputParameterRecord(),
    buildWorkflowOutputParameterRecord(),
    buildWorkflowStepRecord(),
    buildWorkflowStepInputRecord(),
    buildWorkflowStepOutputRecord(),
    buildStepPositionRecord(),
    buildReportRecord(),
    buildToolShedRepositoryRecord(),
  ];

  const rawRecords = new Map<string, SchemaRecord>();
  const records = new Map<string, RecordSchemaNode>();
  for (const raw of rawRecordList) {
    rawRecords.set(raw.name, raw);
    records.set(raw.name, new RecordSchemaNode(raw));
  }

  // Build SchemaEnum objects
  const rawEnumList: SchemaEnum[] = [
    buildGalaxyWorkflowClassEnum(),
    buildAnyEnum(),
    {
      name: "GalaxyType",
      type: "enum",
      doc: "Galaxy data types.",
      symbols:
        galaxyTypeSymbols.length > 0
          ? galaxyTypeSymbols
          : [
              "null",
              "boolean",
              "int",
              "long",
              "float",
              "double",
              "string",
              "integer",
              "text",
              "File",
              "data",
              "collection",
            ],
    },
    {
      name: "WorkflowStepType",
      type: "enum",
      doc: "Workflow step module types.",
      symbols: stepTypeSymbols.length > 0 ? stepTypeSymbols : ["tool", "subworkflow", "pause", "pick_value"],
    },
  ];

  const enums = new Map<string, EnumSchemaNode>();
  for (const raw of rawEnumList) {
    enums.set(raw.name, new EnumSchemaNode(raw));
  }

  // Specializations: abstract base names → concrete record names.
  // This mirrors the CWL specialization in the v19.09 YAML Salad schema and is
  // required for SchemaNodeResolverImpl to properly resolve `inputs`/`outputs`
  // field types (which use the abstract names) while CompletionService's
  // ignoredSchemaRefs suppresses key-level completions.
  const specializations = new Map<string, string>([
    ["InputParameter", "WorkflowInputParameter"],
    ["OutputParameter", "WorkflowOutputParameter"],
  ]);

  return { rawRecords, records, enums, specializations };
}

// ---------------------------------------------------------------------------
// Public loader class
// ---------------------------------------------------------------------------

let cachedJsonSchema: JSchema | null = null;

function getGalaxyWorkflowJsonSchema(): JSchema {
  if (!cachedJsonSchema) {
    cachedJsonSchema = EffectJSONSchema.make(GalaxyWorkflowSchema) as JSchema;
  }
  return cachedJsonSchema;
}

/**
 * Schema loader for gxformat2 workflows that generates structural JSON Schema
 * in-process from the Effect Schema definitions in @galaxy-tool-util/schema.
 *
 * Drop-in replacement for GalaxyWorkflowFormat2SchemaLoader (feature-flagged).
 * Schema updates arrive via `npm update @galaxy-tool-util/schema` — no YAML
 * Salad files, no static schema files, no syncing.
 *
 * @param jsonSchemaOverride - optional pre-computed JSON Schema object; when
 *   omitted the schema is generated at runtime from @galaxy-tool-util/schema.
 *   Pass this in tests to avoid the ESM dependency.
 */
export class JsonSchemaGalaxyWorkflowLoader implements GalaxyWorkflowSchemaLoader {
  public readonly definitions: SchemaDefinitions;
  public readonly nodeResolver: SchemaNodeResolver;

  constructor(jsonSchemaOverride?: JSchema) {
    const jsonSchema = jsonSchemaOverride ?? getGalaxyWorkflowJsonSchema();
    const { rawRecords, records, enums, specializations } = buildDefinitions(jsonSchema);

    const primitiveTypes = new Set(["null", "boolean", "int", "long", "float", "double", "string"]);

    const definitions: SchemaDefinitions = {
      records,
      enums,
      specializations,
      primitiveTypes,
      isPrimitiveType: (type: string) => primitiveTypes.has(type),
    };

    // SchemaNode static definitions must be set before nodes are used
    RecordSchemaNode.definitions = definitions;
    FieldSchemaNode.definitions = definitions;

    this.definitions = definitions;

    const rootRaw = rawRecords.get("GalaxyWorkflow");
    if (!rootRaw) throw new Error("GalaxyWorkflow record not found after JSON Schema conversion");
    this.nodeResolver = new SchemaNodeResolverImpl(definitions, rootRaw);
  }
}
