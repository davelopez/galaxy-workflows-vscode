import { NodePath } from "@gxwf/server-common/src/ast/types";
import { GalaxyWorkflowFormat2SchemaLoader, RecordSchemaNode, SchemaNodeResolver } from "../../src/schema";

describe("Gxformat2 Schema Handling", () => {
  describe("Schema Version 19_09", () => {
    let schemaLoader: GalaxyWorkflowFormat2SchemaLoader;
    beforeAll(() => {
      schemaLoader = new GalaxyWorkflowFormat2SchemaLoader();
    });
    describe("GalaxyWorkflowFormat2SchemaLoader", () => {
      it("should load all schema record definitions", () => {
        expect(schemaLoader.definitions.records.size).toBe(25);
      });
    });

    describe("SchemaNodeResolver", () => {
      let nodeResolver: SchemaNodeResolver;
      beforeAll(() => {
        nodeResolver = schemaLoader.nodeResolver;
      });
      describe("resolveSchemaContext", () => {
        it.each([
          [["class"], "class"],
          [["inputs"], "inputs"],
          [["inputs", 0], "WorkflowInputParameter"],
          [["inputs", 0, "doc"], "doc"],
          [["inputs", "input1"], "WorkflowInputParameter"],
          [["inputs", "input1", "label"], "label"],
          [["outputs"], "outputs"],
          [["outputs", 1], "WorkflowOutputParameter"],
          [["outputs", "output1"], "WorkflowOutputParameter"],
          [["steps"], "steps"],
          [["steps", 5], "WorkflowStep"],
          [["steps", "random", "tool_id"], "tool_id"],
        ])("returns expected schema node name from path", (nodePath: NodePath, expectedNodeName: string) => {
          const schemaNode = nodeResolver.resolveSchemaContext(nodePath);
          expect(schemaNode).toBeDefined();
          expect(schemaNode?.name).toBe(expectedNodeName);
        });
      });
    });

    describe("Definitions", () => {
      function expectRecordHasOptionalStringField(
        record: RecordSchemaNode,
        fieldName: string,
        canBeArray = false
      ): void {
        const field = record.getFieldByName(fieldName);
        expect(field).toBeDefined();
        expect(field?.isOptional).toBe(true);
        expect(field?.canBeArray).toBe(canBeArray);
        expect(field?.canBeObject).toBe(false);
        expect(field?.typeRef).toBe("string");
      }
      describe("GalaxyWorkflow Record", () => {
        it("should have the expected field definitions", () => {
          const record = schemaLoader.definitions.records.get("GalaxyWorkflow") as RecordSchemaNode;
          expect(record).toBeDefined();
          expect(record.name).toBe("GalaxyWorkflow");
          expect(record.documentation).toBeDefined();
          expect(record.fields.length).toBe(13);
          let field = record.getFieldByName("class");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(false);
          expect(field?.canBeArray).toBe(false);
          expect(field?.canBeObject).toBe(false);
          expect(field?.typeRef).toBe("string");
          field = record.getFieldByName("steps");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(false);
          expect(field?.canBeArray).toBe(true);
          expect(field?.canBeObject).toBe(false);
          expect(field?.typeRef).toBe("WorkflowStep");
          field = record.getFieldByName("report");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.canBeArray).toBe(false);
          expect(field?.canBeObject).toBe(true);
          expect(field?.typeRef).toBe("Report");
          field = record.getFieldByName("tags");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.canBeArray).toBe(true);
          expect(field?.canBeObject).toBe(false);
          expect(field?.typeRef).toBe("string");
          field = record.getFieldByName("creator");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.canBeArray).toBe(true);
          expect(field?.canBeObject).toBe(true);
          expect(field?.typeRef).toBe("Any");
          field = record.getFieldByName("license");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.canBeArray).toBe(false);
          expect(field?.canBeObject).toBe(false);
          expect(field?.typeRef).toBe("string");
          field = record.getFieldByName("release");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.canBeArray).toBe(false);
          expect(field?.canBeObject).toBe(false);
          expect(field?.typeRef).toBe("string");

          // HasUUID
          expectRecordHasOptionalStringField(record, "uuid");

          expectRecordHasOptionalStringField(record, "id");
          expectRecordHasOptionalStringField(record, "label");
          expectRecordHasOptionalStringField(record, "doc", true);
        });
      });

      describe("WorkflowStep Record", () => {
        it("should have the expected field definitions", () => {
          const record = schemaLoader.definitions.records.get("WorkflowStep") as RecordSchemaNode;
          expect(record).toBeDefined();
          expect(record.name).toBe("WorkflowStep");
          expect(record.documentation).toBeDefined();
          expect(record.fields.length).toBe(16);
          let field = record.getFieldByName("in");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.canBeArray).toBe(true);
          expect(field?.canBeObject).toBe(false);
          expect(field?.matchesType("null")).toBe(true);
          expect(field?.matchesType("WorkflowStepInput")).toBe(true);
          field = record.getFieldByName("out");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.canBeArray).toBe(true);
          expect(field?.canBeObject).toBe(false);
          expect(field?.matchesType("null")).toBe(true);
          expect(field?.matchesType("string")).toBe(true);
          expect(field?.matchesType("WorkflowStepOutput")).toBe(true);
          expect(field?.matchesType("Any")).toBe(false);
          field = record.getFieldByName("state");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.typeRef).toBe("Any");
          expect(field?.canBeArray).toBe(true);
          expect(field?.canBeObject).toBe(true);
          expect(field?.matchesType("null")).toBe(true);
          expect(field?.matchesType("string")).toBe(true);
          expect(field?.matchesType("anything...")).toBe(true);
          field = record.getFieldByName("type");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.canBeArray).toBe(false);
          expect(field?.canBeObject).toBe(false);
          expect(field?.default).toBe("tool");
          field = record.getFieldByName("run");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.canBeArray).toBe(false);
          expect(field?.canBeObject).toBe(true);
          expect(field?.typeRef).toBe("GalaxyWorkflow");
          field = record.getFieldByName("runtime_inputs");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.canBeArray).toBe(true);
          expect(field?.canBeObject).toBe(false);
          expect(field?.typeRef).toBe("string");

          expectRecordHasOptionalStringField(record, "id");
          expectRecordHasOptionalStringField(record, "label");
          expectRecordHasOptionalStringField(record, "doc", true);

          // HasStepPosition
          field = record.getFieldByName("position");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.canBeArray).toBe(false);
          expect(field?.canBeObject).toBe(true);
          expect(field?.typeRef).toBe("StepPosition");

          // ReferencesTool
          expectRecordHasOptionalStringField(record, "tool_id");
          expectRecordHasOptionalStringField(record, "tool_version");
          field = record.getFieldByName("tool_shed_repository");
          expect(field).toBeDefined();
          expect(field?.isOptional).toBe(true);
          expect(field?.canBeArray).toBe(false);
          expect(field?.canBeObject).toBe(true);
          expect(field?.typeRef).toBe("ToolShedRepository");

          // HasStepErrors
          expectRecordHasOptionalStringField(record, "errors");

          // HasUUID
          expectRecordHasOptionalStringField(record, "uuid");
        });
      });
    });
  });
});
