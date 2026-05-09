import { JSONSchema } from "vscode-json-languageservice";
import { NativeGalaxyWorkflowSchema } from "@galaxy-tool-util/schema";
import { JSONSchema as EffectJSONSchema } from "effect";

const SCHEMA_ID = "https://github.com/davelopez/galaxy-workflows-vscode/workflow-languages/schemas/native";

let cachedNativeSchema: JSONSchema | null = null;

function getNativeWorkflowJsonSchema(): JSONSchema {
  if (!cachedNativeSchema) {
    const raw = EffectJSONSchema.make(NativeGalaxyWorkflowSchema) as JSONSchema & {
      required?: string[];
    };
    // "class" is a format2 artifact; native .ga files don't have it
    const required = Array.isArray(raw.required) ? raw.required.filter((f) => f !== "class") : raw.required;
    cachedNativeSchema = { id: SCHEMA_ID, ...raw, required } as JSONSchema;
  }
  return cachedNativeSchema;
}

/**
 * Schema loader for native Galaxy workflows (.ga JSON format).
 *
 * Generates the JSON Schema in-process from the Effect Schema definitions in
 * @galaxy-tool-util/schema. Drop-in replacement for the static native.schema.json.
 *
 * @param jsonSchemaOverride - optional pre-computed JSON Schema; when omitted
 *   the schema is generated at runtime from @galaxy-tool-util/schema.
 *   Pass this in tests to avoid the ESM dependency.
 */
export class JsonSchemaNativeWorkflowLoader {
  public readonly jsonSchema: JSONSchema;

  constructor(jsonSchemaOverride?: Record<string, unknown>) {
    if (jsonSchemaOverride) {
      const required = Array.isArray(jsonSchemaOverride.required)
        ? (jsonSchemaOverride.required as string[]).filter((f) => f !== "class")
        : jsonSchemaOverride.required;
      this.jsonSchema = { id: SCHEMA_ID, ...jsonSchemaOverride, required } as JSONSchema;
    } else {
      this.jsonSchema = getNativeWorkflowJsonSchema();
    }
  }
}
