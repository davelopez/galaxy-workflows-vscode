import { Diagnostic, ValidationRule } from "@gxwf/server-common/src/languageTypes";
import {
  ChildrenRequiredPropertyValidationRule,
  StepExportErrorValidationRule,
} from "@gxwf/server-common/src/providers/validation/rules";
import { GalaxyWorkflowFormat2SchemaLoader } from "../../src/schema";
import { GxFormat2SchemaValidationService } from "../../src/services/schemaValidationService";
import { InputTypeValidationRule } from "../../src/validation/rules/InputTypeValidationRule";
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

  it("should report error for invalid input type value", async () => {
    const content = `
class: GalaxyWorkflow
inputs:
    the_input:
        type: 5
outputs:
steps:
    `;
    const diagnostics = await validateDocument(content);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe(
      "Type mismatch for field 'type'. Expected 'GalaxyType | string' but found 'number'."
    );
  });

  it("should report error for invalid enum value", async () => {
    const content = `
class: GalaxyWorkflow
inputs:
outputs:
steps:
    step:
      type: unknown
    `;
    const diagnostics = await validateDocument(content);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toBe(
      "The value is not a valid 'WorkflowStepType'. Allowed values are: tool, subworkflow, pause."
    );
  });

  it("should not report error for valid enum value", async () => {
    const content = `
class: GalaxyWorkflow
inputs:
outputs:
steps:
    step:
      type: tool
    `;
    const diagnostics = await validateDocument(content);
    expect(diagnostics).toHaveLength(0);
  });

  it("should not report error for compatible primitive types", async () => {
    const content = `
class: GalaxyWorkflow
inputs:
outputs:
steps:
    step:
      position:
        top: 0
        left: 0
    `;
    const diagnostics = await validateDocument(content);
    expect(diagnostics).toHaveLength(0);
  });

  it("should report error for incompatible primitive types", async () => {
    const content = `
class: GalaxyWorkflow
inputs:
outputs:
steps:
    step:
      position:
        top: "not a number"
        left: 0
    `;
    const diagnostics = await validateDocument(content);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain(
      "Type mismatch for field 'top'. Expected 'float | int' but found 'string'."
    );
  });

  it("should not report error for properties with Any type", async () => {
    const content = `
class: GalaxyWorkflow
inputs:
outputs:
steps:
    step:
      tool_state:
        value: "any value"
        another_value: 42
    `;
    const diagnostics = await validateDocument(content);
    expect(diagnostics).toHaveLength(0);
  });

  it("should not report error when multiple types are allowed (string)", async () => {
    const content = `
class: GalaxyWorkflow
inputs:
outputs:
steps:
    step:
      out: a string
    `;
    const diagnostics = await validateDocument(content);
    expect(diagnostics).toHaveLength(0);
  });

  it("should not report error when multiple types are allowed (object)", async () => {
    const content = `
class: GalaxyWorkflow
inputs:
outputs:
steps:
    step:
      out:
        add_tags:
          - tag1
          - tag2
    `;
    const diagnostics = await validateDocument(content);
    expect(diagnostics).toHaveLength(0);
  });

  describe("Custom Rules", () => {
    let rule: ValidationRule;

    function validateRule(documentContents: string): Promise<Diagnostic[]> {
      const document = createFormat2WorkflowDocument(documentContents);
      return rule.validate(document);
    }

    describe("InputTypeValidationRule", () => {
      beforeAll(() => {
        rule = new InputTypeValidationRule();
      });

      it("should report error when input default value has invalid type", async () => {
        const content = `
class: GalaxyWorkflow
inputs:
    the_input:
        type: int
        default: this is not a number
outputs:
steps:
    `;
        const diagnostics = await validateRule(content);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe(
          "Input 'the_input' default value has invalid type. Expected 'int' but found 'string'."
        );
      });

      it("should not report error when input default value has valid type", async () => {
        const content = `
class: GalaxyWorkflow
inputs:
    the_input:
        type: int
        default: 42
outputs:
steps:
    `;
        const diagnostics = await validateRule(content);
        expect(diagnostics).toHaveLength(0);
      });
    });

    describe("StepExportErrorValidationRule", () => {
      beforeAll(() => {
        rule = new StepExportErrorValidationRule();
      });

      it("should report error when step contains export errors", async () => {
        const content = `
class: GalaxyWorkflow
steps:
    step:
        tool_id: tool_id
        errors: error in step
    `;
        const diagnostics = await validateRule(content);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toContain(
          "Tool step contains error indicated during Galaxy export - error in step"
        );
      });

      it("should not report error when step does not contain export errors", async () => {
        const content = `
class: GalaxyWorkflow
steps:
    step:
        tool_id: tool_id
    `;
        const diagnostics = await validateRule(content);
        expect(diagnostics).toHaveLength(0);
      });

      it("should not report error when step errors are null", async () => {
        const content = `
class: GalaxyWorkflow
steps:
    step:
        tool_id: tool_id
        errors: null
    `;
        const diagnostics = await validateRule(content);
        expect(diagnostics).toHaveLength(0);
      });
    });

    describe("ChildrenRequiredPropertyValidationRule", () => {
      beforeAll(() => {
        rule = new ChildrenRequiredPropertyValidationRule("steps", "doc");
      });

      it("should report error when step is missing required property", async () => {
        const content = `
class: GalaxyWorkflow
steps:
    step:
        tool_id: tool_id
    `;
        const diagnostics = await validateRule(content);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('Missing required property "doc".');
      });

      it("should not report error when all steps have required property", async () => {
        const content = `
class: GalaxyWorkflow
steps:
    step:
        tool_id: tool_id
        doc: step doc
    step2:
        tool_id: tool_id
        doc: step2 doc
    `;
        const diagnostics = await validateRule(content);
        expect(diagnostics).toHaveLength(0);
      });

      it("should report error when step has empty required property", async () => {
        const content = `
class: GalaxyWorkflow
steps:
    step:
        tool_id: tool_id
        doc:
    `;
        const diagnostics = await validateRule(content);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('Missing required value in property "doc".');
      });

      it("should not report error when there are no steps", async () => {
        const content = `
class: GalaxyWorkflow
steps:
    `;
        const diagnostics = await validateRule(content);
        expect(diagnostics).toHaveLength(0);
      });

      it("should not report error when the steps property does not exist", async () => {
        const content = `
class: GalaxyWorkflow
    `;
        const diagnostics = await validateRule(content);
        expect(diagnostics).toHaveLength(0);
      });
    });
  });
});
