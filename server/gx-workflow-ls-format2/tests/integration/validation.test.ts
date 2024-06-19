import { Diagnostic } from "@gxwf/server-common/src/languageTypes";
import { GalaxyWorkflowFormat2SchemaLoader } from "../../src/schema";
import { GxFormat2SchemaValidationService } from "../../src/services/schemaValidationService";
import { createFormat2WorkflowDocument } from "../testHelpers";

describe("Schema validation", () => {
  let validator: GxFormat2SchemaValidationService;

  function validateDocument(documentContents: string): Promise<Diagnostic[]> {
    const document = createFormat2WorkflowDocument(documentContents);
    return validator.doValidation(document);
  }

  beforeAll(() => {
    const schemaNodeResolver = new GalaxyWorkflowFormat2SchemaLoader().nodeResolver;
    validator = new GxFormat2SchemaValidationService(schemaNodeResolver);
  });

  it("should validate a correct workflow", async () => {
    const content = `
class: GalaxyWorkflow
doc: |
  Simple workflow that no-op cats a file.
inputs:
  the_input:
    type: File
    doc: input doc
outputs:
  the_output:
    outputSource: cat/out_file1
steps:
  cat:
    tool_id: cat1
    doc: cat doc
    in:
      input1: the_input
    `;
    const diagnostics = await validateDocument(content);
    expect(diagnostics).toHaveLength(0);
  });

  it("should report error when a property has incorrect type value", async () => {
    const content = `
class: null
inputs:
outputs:
steps:
    `;
    const diagnostics = await validateDocument(content);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe("Type mismatch for field 'class'. Expected 'string' but found 'null'.");
  });

  it("should report error for missing required properties", async () => {
    const content = `
class: GalaxyWorkflow
    `;
    const diagnostics = await validateDocument(content);
    expect(diagnostics).toHaveLength(3);
    expect(diagnostics[0].message).toBe("The 'steps' field is required.");
    expect(diagnostics[1].message).toBe("The 'inputs' field is required.");
    expect(diagnostics[2].message).toBe("The 'outputs' field is required.");
  });

  it("should report error for invalid enum value", async () => {
    const content = `
class: GalaxyWorkflow
inputs:
    the_input:
        type: unknown
outputs:
steps:
    `;
    const diagnostics = await validateDocument(content);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe(
      "The value is not a valid 'GalaxyType'. Allowed values are: integer, text, File, data, collection, null, boolean, int, long, float, double, string."
    );
  });
});
