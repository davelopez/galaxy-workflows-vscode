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
          [["inputs", 0], "InputParameter"],
          [["inputs", 0, "doc"], "doc"],
          [["inputs", "input1"], "InputParameter"],
          [["inputs", "input1", "label"], "label"],
          [["outputs"], "outputs"],
          [["outputs", 1], "OutputParameter"],
          [["outputs", "output1"], "OutputParameter"],
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
  });
});
