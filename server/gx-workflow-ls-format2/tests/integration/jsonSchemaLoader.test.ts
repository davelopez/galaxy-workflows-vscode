import { GalaxyWorkflowSchema } from "@galaxy-tool-util/schema";
import { JSONSchema } from "effect";
import { CompletionList } from "@gxwf/server-common/src/languageTypes";
import { getCompletionItemsLabels, parseTemplate } from "@gxwf/server-common/tests/testHelpers";

import "reflect-metadata";
import { RecordSchemaNode, SchemaNodeResolver } from "../../src/schema";
import { JsonSchemaGalaxyWorkflowLoader } from "../../src/schema/jsonSchemaLoader";
import { GxFormat2CompletionService } from "../../src/services/completionService";
import { createFormat2WorkflowDocument } from "../testHelpers";

const galaxyWorkflowJsonSchema = JSONSchema.make(GalaxyWorkflowSchema) as Record<string, unknown>;

describe("JsonSchemaGalaxyWorkflowLoader", () => {
  let loader: JsonSchemaGalaxyWorkflowLoader;
  let nodeResolver: SchemaNodeResolver;
  let completionService: GxFormat2CompletionService;

  beforeAll(() => {
    loader = new JsonSchemaGalaxyWorkflowLoader(galaxyWorkflowJsonSchema);
    nodeResolver = loader.nodeResolver;
    completionService = new GxFormat2CompletionService(nodeResolver);
  });

  async function getCompletions(
    contents: string,
    position: { line: number; character: number }
  ): Promise<CompletionList> {
    const documentContext = createFormat2WorkflowDocument(contents);
    return await completionService.doComplete(documentContext, position);
  }

  // ---------------------------------------------------------------------------
  // Definitions
  // ---------------------------------------------------------------------------

  describe("definitions", () => {
    it("should contain expected record names", () => {
      const recordNames = Array.from(loader.definitions.records.keys());
      expect(recordNames).toContain("GalaxyWorkflow");
      expect(recordNames).toContain("WorkflowInputParameter");
      expect(recordNames).toContain("WorkflowOutputParameter");
      expect(recordNames).toContain("WorkflowStep");
      expect(recordNames).toContain("WorkflowStepInput");
      expect(recordNames).toContain("WorkflowStepOutput");
      expect(recordNames).toContain("StepPosition");
      expect(recordNames).toContain("Report");
      expect(recordNames).toContain("ToolShedRepository");
    });

    it("should contain expected enum names", () => {
      const enumNames = Array.from(loader.definitions.enums.keys());
      expect(enumNames).toContain("GalaxyWorkflowClass");
      expect(enumNames).toContain("GalaxyType");
      expect(enumNames).toContain("WorkflowStepType");
      expect(enumNames).toContain("Any");
    });

    it("should have specializations for abstract types", () => {
      expect(loader.definitions.specializations.get("InputParameter")).toBe("WorkflowInputParameter");
      expect(loader.definitions.specializations.get("OutputParameter")).toBe("WorkflowOutputParameter");
    });

    describe("GalaxyWorkflow record", () => {
      let record: RecordSchemaNode;
      beforeAll(() => {
        record = loader.definitions.records.get("GalaxyWorkflow") as RecordSchemaNode;
      });

      it("should be defined with a root record node", () => {
        expect(record).toBeDefined();
        expect(nodeResolver.rootNode.name).toBe("GalaxyWorkflow");
      });

      it("should have expected string fields", () => {
        for (const fieldName of ["id", "label", "uuid", "license", "release"]) {
          const field = record.getFieldByName(fieldName);
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.typeRef).toBe("string");
          expect(field?.canBeArray).toBe(false);
        }
      });

      it("should have doc as optional string-or-array", () => {
        const field = record.getFieldByName("doc");
        expect(field?.isOptional).toBe(true);
        expect(field?.typeRef).toBe("string");
        expect(field?.canBeArray).toBe(true);
      });

      it("should have steps as required array of WorkflowStep", () => {
        const field = record.getFieldByName("steps");
        expect(field?.isOptional).toBe(false);
        expect(field?.canBeArray).toBe(true);
        expect(field?.typeRef).toBe("WorkflowStep");
      });

      it("should have inputs as array using abstract InputParameter type", () => {
        const field = record.getFieldByName("inputs");
        expect(field?.canBeArray).toBe(true);
        expect(field?.typeRef).toBe("InputParameter");
      });

      it("should have outputs as array using abstract OutputParameter type", () => {
        const field = record.getFieldByName("outputs");
        expect(field?.canBeArray).toBe(true);
        expect(field?.typeRef).toBe("OutputParameter");
      });

      it("should have report as optional Record field", () => {
        const field = record.getFieldByName("report");
        expect(field?.isOptional).toBe(true);
        expect(field?.canBeObject).toBe(true);
        expect(field?.typeRef).toBe("Report");
      });

      it("should have tags as optional array of strings", () => {
        const field = record.getFieldByName("tags");
        expect(field?.isOptional).toBe(true);
        expect(field?.canBeArray).toBe(true);
        expect(field?.typeRef).toBe("string");
      });
    });

    describe("WorkflowStep record", () => {
      let record: RecordSchemaNode;
      beforeAll(() => {
        record = loader.definitions.records.get("WorkflowStep") as RecordSchemaNode;
      });

      it("should be defined", () => {
        expect(record).toBeDefined();
      });

      it("should have string fields", () => {
        for (const f of ["id", "label", "uuid", "tool_id", "tool_version", "errors", "when"]) {
          expect(record.getFieldByName(f)?.typeRef).toBe("string");
          expect(record.getFieldByName(f)?.isOptional).toBe(true);
        }
      });

      it("should have state as Any", () => {
        const field = record.getFieldByName("state");
        expect(field?.canBeAny).toBe(true);
        expect(field?.isOptional).toBe(true);
      });

      it("should have type as optional WorkflowStepType enum", () => {
        const field = record.getFieldByName("type");
        expect(field?.isOptional).toBe(true);
        expect(field?.default).toBe("tool");
      });

      it("should have position as optional StepPosition", () => {
        const field = record.getFieldByName("position");
        expect(field?.isOptional).toBe(true);
        expect(field?.typeRef).toBe("StepPosition");
        expect(field?.canBeObject).toBe(true);
      });

      it("should have tool_shed_repository as optional ToolShedRepository", () => {
        const field = record.getFieldByName("tool_shed_repository");
        expect(field?.isOptional).toBe(true);
        expect(field?.typeRef).toBe("ToolShedRepository");
      });

      it("should have run as optional GalaxyWorkflow", () => {
        const field = record.getFieldByName("run");
        expect(field?.isOptional).toBe(true);
        expect(field?.typeRef).toBe("GalaxyWorkflow");
      });

      it("should have in as optional array of WorkflowStepInput", () => {
        const field = record.getFieldByName("in");
        expect(field?.isOptional).toBe(true);
        expect(field?.canBeArray).toBe(true);
        expect(field?.matchesType("WorkflowStepInput")).toBe(true);
      });
    });

    describe("getSchemaNodeByTypeRef", () => {
      it.each([
        ["GalaxyWorkflow", "GalaxyWorkflow"],
        ["WorkflowInputParameter", "WorkflowInputParameter"],
        ["WorkflowOutputParameter", "WorkflowOutputParameter"],
        ["WorkflowStep", "WorkflowStep"],
        ["StepPosition", "StepPosition"],
        ["ToolShedRepository", "ToolShedRepository"],
        ["Report", "Report"],
        // abstract types resolve via specialization
        ["InputParameter", "WorkflowInputParameter"],
        ["OutputParameter", "WorkflowOutputParameter"],
      ])("resolves '%s' to node named '%s'", (typeRef, expectedName) => {
        const node = nodeResolver.getSchemaNodeByTypeRef(typeRef);
        expect(node).toBeDefined();
        expect(node?.name).toBe(expectedName);
      });
    });

    describe("resolveSchemaContext", () => {
      it.each([
        [["inputs", "my_input"], "WorkflowInputParameter"],
        [["outputs", "my_output"], "WorkflowOutputParameter"],
        [["steps", "my_step"], "WorkflowStep"],
        [["steps", "my_step", "tool_id"], "tool_id"],
        [["steps", "my_step", "in", "conn"], "WorkflowStepInput"],
      ])("resolves path %j to node named '%s'", (path, expectedName) => {
        const node = nodeResolver.resolveSchemaContext(path);
        expect(node).toBeDefined();
        expect(node?.name).toBe(expectedName);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Completions
  // ---------------------------------------------------------------------------

  describe("completions", () => {
    it("should suggest all basic workflow properties when document is empty", async () => {
      const template = `\n$`;
      const { contents, position } = parseTemplate(template);
      const completions = await getCompletions(contents, position);
      const labels = getCompletionItemsLabels(completions);
      // Core workflow properties must be present
      expect(labels).toContain("class");
      expect(labels).toContain("steps");
      expect(labels).toContain("inputs");
      expect(labels).toContain("outputs");
      expect(labels).toContain("label");
      expect(labels).toContain("doc");
      expect(labels).toContain("uuid");
      expect(labels).toContain("report");
      expect(labels).toContain("tags");
      expect(labels).toContain("license");
      expect(labels).toContain("release");
    });

    it("should suggest 'GalaxyWorkflow' for class value", async () => {
      const template = `\nclass: $`;
      const { contents, position } = parseTemplate(template);
      const completions = await getCompletions(contents, position);
      const labels = getCompletionItemsLabels(completions);
      expect(labels).toContain("GalaxyWorkflow");
    });

    it("should not suggest properties when defining new workflow inputs", async () => {
      const template = `
class: GalaxyWorkflow
inputs:
  $`;
      const { contents, position } = parseTemplate(template);
      const completions = await getCompletions(contents, position);
      expect(completions.items.length).toBe(0);
    });

    it("should not suggest properties when defining new workflow steps", async () => {
      const template = `
class: GalaxyWorkflow
steps:
  $`;
      const { contents, position } = parseTemplate(template);
      const completions = await getCompletions(contents, position);
      expect(completions.items.length).toBe(0);
    });

    it("should suggest input properties inside a named input", async () => {
      const template = `
class: GalaxyWorkflow
inputs:
  My input:
    $`;
      const { contents, position } = parseTemplate(template);
      const completions = await getCompletions(contents, position);
      const labels = getCompletionItemsLabels(completions);
      expect(labels).toContain("type");
      expect(labels).toContain("optional");
      expect(labels).toContain("format");
      expect(labels).toContain("collection_type");
      expect(labels).toContain("label");
      expect(labels).toContain("doc");
    });

    it("should suggest galaxy types for input type", async () => {
      const template = `
class: GalaxyWorkflow
inputs:
  My input:
    type: $`;
      const { contents, position } = parseTemplate(template);
      const completions = await getCompletions(contents, position);
      const labels = getCompletionItemsLabels(completions);
      expect(labels).toContain("data");
      expect(labels).toContain("collection");
      expect(labels).toContain("string");
    });

    it("should suggest step properties inside a named step", async () => {
      const template = `
class: GalaxyWorkflow
steps:
  my_step:
    $`;
      const { contents, position } = parseTemplate(template);
      const completions = await getCompletions(contents, position);
      const labels = getCompletionItemsLabels(completions);
      expect(labels).toContain("tool_id");
      expect(labels).toContain("state");
      expect(labels).toContain("type");
      expect(labels).toContain("in");
      expect(labels).toContain("out");
    });

    it("should suggest step types including pick_value from new schema", async () => {
      const template = `
class: GalaxyWorkflow
steps:
  my_step:
    type: $`;
      const { contents, position } = parseTemplate(template);
      const completions = await getCompletions(contents, position);
      const labels = getCompletionItemsLabels(completions);
      expect(labels).toContain("tool");
      expect(labels).toContain("subworkflow");
      expect(labels).toContain("pause");
      // pick_value is included in the JSON schema (improvement over YAML Salad v19.09)
      expect(labels).toContain("pick_value");
    });

    it("should suggest report properties inside report", async () => {
      const template = `
class: GalaxyWorkflow
report:
  $`;
      const { contents, position } = parseTemplate(template);
      const completions = await getCompletions(contents, position);
      const labels = getCompletionItemsLabels(completions);
      expect(labels).toContain("markdown");
    });
  });
});
