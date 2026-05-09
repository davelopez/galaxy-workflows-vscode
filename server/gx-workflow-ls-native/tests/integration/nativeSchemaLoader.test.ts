import { NativeGalaxyWorkflowSchema } from "@galaxy-tool-util/schema";
import { JSONSchema } from "effect";
import { JsonSchemaNativeWorkflowLoader } from "../../src/schema/jsonSchemaLoader";

const nativeWorkflowJsonSchema = JSONSchema.make(NativeGalaxyWorkflowSchema) as Record<string, unknown>;

describe("JsonSchemaNativeWorkflowLoader", () => {
  let loader: JsonSchemaNativeWorkflowLoader;

  beforeAll(() => {
    loader = new JsonSchemaNativeWorkflowLoader(nativeWorkflowJsonSchema);
  });

  it("should produce a schema with an id", () => {
    expect(loader.jsonSchema.id).toBeTruthy();
  });

  it("should not require 'class' (format2 artifact)", () => {
    const required = loader.jsonSchema.required ?? [];
    expect(required).not.toContain("class");
  });

  it("should require 'a_galaxy_workflow'", () => {
    const required = loader.jsonSchema.required ?? [];
    expect(required).toContain("a_galaxy_workflow");
  });

  it("should require 'format-version'", () => {
    const required = loader.jsonSchema.required ?? [];
    expect(required).toContain("format-version");
  });

  it("should expose top-level workflow properties", () => {
    const props = Object.keys((loader.jsonSchema as Record<string, unknown>).properties as object);
    expect(props).toContain("name");
    expect(props).toContain("steps");
    expect(props).toContain("uuid");
    expect(props).toContain("release");
    expect(props).toContain("license");
    expect(props).toContain("tags");
    expect(props).toContain("creator");
  });

  it("should expose step properties including modern fields", () => {
    const defs = (loader.jsonSchema as Record<string, unknown>).$defs as Record<string, unknown>;
    const stepSchema = defs["NativeStepSchema"] as Record<string, unknown>;
    const stepProps = Object.keys((stepSchema?.properties ?? {}) as object);
    expect(stepProps).toContain("tool_id");
    expect(stepProps).toContain("type");
    expect(stepProps).toContain("position");
    expect(stepProps).toContain("when");
    expect(stepProps).toContain("errors");
  });
});
