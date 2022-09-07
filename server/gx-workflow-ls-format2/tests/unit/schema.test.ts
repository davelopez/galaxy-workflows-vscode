import { NodePath } from "@gxwf/server-common/src/ast/types";
import { GalaxyWorkflowFormat2SchemaLoader, SchemaNodeResolver } from "../../src/schema";

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
      it("should define GalaxyWorkflow record as expected", () => {
        const record = schemaLoader.definitions.records.get("GalaxyWorkflow");
        expect(record).toBeDefined();
        expect(record?.name).toBe("GalaxyWorkflow");
        expect(record?.documentation).toBeDefined();
        expect(record?.fields.length).toBe(13);
        const field = record?.getFieldByName("class");
        expect(field).toBeDefined();
        expect(field?.typeRef).toBe("string");
      });

      it("should define WorkflowStep record as expected", () => {
        const record = schemaLoader.definitions.records.get("WorkflowStep");
        expect(record).toBeDefined();
        expect(record?.name).toBe("WorkflowStep");
        expect(record?.documentation).toBeDefined();
        expect(record?.fields.length).toBe(16);
        let field = record?.getFieldByName("in");
        expect(field).toBeDefined();
        expect(field?.isOptional).toBe(true);
        expect(field?.canBeArray).toBe(true);
        expect(field?.matchesType("null")).toBe(true);
        expect(field?.matchesType("WorkflowStepInput")).toBe(true);
        field = record?.getFieldByName("out");
        expect(field).toBeDefined();
        expect(field?.isOptional).toBe(true);
        expect(field?.canBeArray).toBe(true);
        expect(field?.matchesType("null")).toBe(true);
        expect(field?.matchesType("string")).toBe(true);
        expect(field?.matchesType("WorkflowStepOutput")).toBe(true);
        expect(field?.matchesType("Any")).toBe(false);
        field = record?.getFieldByName("state");
        expect(field).toBeDefined();
        expect(field?.isOptional).toBe(true);
        expect(field?.typeRef).toBe("Any");
        expect(field?.canBeArray).toBe(true);
        expect(field?.matchesType("null")).toBe(true);
        expect(field?.matchesType("string")).toBe(true);
        expect(field?.matchesType("anything...")).toBe(true);
      });
    });
  });
});
