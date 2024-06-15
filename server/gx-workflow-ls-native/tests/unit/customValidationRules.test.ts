import { DiagnosticSeverity } from "@gxwf/server-common/src/languageTypes";
import { MissingPropertyValidationRule } from "@gxwf/server-common/src/providers/validation/rules";
import { WorkflowOutputLabelValidationRule } from "../../src/validation/rules/WorkflowOutputLabelValidation";
import { createNativeWorkflowDocument } from "../testHelpers";
import { TestWorkflowProvider } from "../testWorkflowProvider";

describe("Custom Validation Rules", () => {
  describe("WorkflowOutputLabelValidation Rule", () => {
    let rule: WorkflowOutputLabelValidationRule;

    beforeEach(() => {
      rule = new WorkflowOutputLabelValidationRule();
    });

    it("should not provide diagnostics when there are no steps", async () => {
      const wfDocument = createNativeWorkflowDocument(TestWorkflowProvider.workflows.validation.withoutSteps);
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(0);
    });

    it("should not provide diagnostics when there are no workflow_outputs in the steps", async () => {
      const wfDocument = createNativeWorkflowDocument(TestWorkflowProvider.workflows.validation.withThreeSteps);
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(0);
    });

    it("should not provide diagnostics when the steps contains workflow_outputs with label", async () => {
      const wfDocument = createNativeWorkflowDocument(
        TestWorkflowProvider.workflows.validation.withWorkflowOutputLabels
      );
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(0);
    });

    it("should provide diagnostics when the steps contains workflow_outputs without label", async () => {
      const wfDocument = createNativeWorkflowDocument(
        TestWorkflowProvider.workflows.validation.withoutWorkflowOutputLabels
      );
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(2);
      diagnostics.forEach((diagnostic) => {
        expect(diagnostic.message).toBe("Missing label in workflow output.");
      });
    });
  });

  describe("MissingPropertyValidation Rule", () => {
    let rule: MissingPropertyValidationRule;

    beforeEach(() => {
      rule = new MissingPropertyValidationRule("release");
    });

    it("should not provide diagnostics when the property is present", async () => {
      const wfContents = `{
        "a_galaxy_workflow": "true",
        "release": "0.1",
      }`;
      const wfDocument = createNativeWorkflowDocument(wfContents);
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(0);
    });

    it("should provide error diagnostics when the property is missing", async () => {
      const wfContents = `{
        "a_galaxy_workflow": "true",
      }`;
      const wfDocument = createNativeWorkflowDocument(wfContents);
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe('Missing property "release".');
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
    });

    it("should provide error diagnostics when the property is present but has no value", async () => {
      const wfContents = `{
        "a_galaxy_workflow": "true",
        "release": "",
      }`;
      const wfDocument = createNativeWorkflowDocument(wfContents);
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe('Missing value in property "release".');
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
    });

    it("should provide warning diagnostics when the property is missing and severity is set to warning", async () => {
      rule = new MissingPropertyValidationRule("release", true, DiagnosticSeverity.Warning);
      const wfContents = `{
        "a_galaxy_workflow": "true",
      }`;
      const wfDocument = createNativeWorkflowDocument(wfContents);
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe('Missing property "release".');
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Warning);
    });

    it("should display a custom message when provided", async () => {
      rule = new MissingPropertyValidationRule("release", true, DiagnosticSeverity.Warning, "Custom message");
      const wfContents = `{
        "a_galaxy_workflow": "true",
      }`;
      const wfDocument = createNativeWorkflowDocument(wfContents);
      const diagnostics = await rule.validate(wfDocument);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].message).toBe("Custom message");
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Warning);
    });

    describe("when valueRequired is false", () => {
      beforeEach(() => {
        rule = new MissingPropertyValidationRule("release", false);
      });

      it("should not provide diagnostics when the property is present", async () => {
        const wfContents = `{
          "a_galaxy_workflow": "true",
          "release": "0.1",
        }`;
        const wfDocument = createNativeWorkflowDocument(wfContents);
        const diagnostics = await rule.validate(wfDocument);
        expect(diagnostics).toHaveLength(0);
      });

      it("should provide diagnostics when the property is missing", async () => {
        const wfContents = `{
          "a_galaxy_workflow": "true",
        }`;
        const wfDocument = createNativeWorkflowDocument(wfContents);
        const diagnostics = await rule.validate(wfDocument);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('Missing property "release".');
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      });

      it("should not provide diagnostics when the property is present but has no value", async () => {
        const wfContents = `{
          "a_galaxy_workflow": "true",
          "release": "",
        }`;
        const wfDocument = createNativeWorkflowDocument(wfContents);
        const diagnostics = await rule.validate(wfDocument);
        expect(diagnostics).toHaveLength(0);
      });
    });

    describe("when the property is an array", () => {
      beforeEach(() => {
        rule = new MissingPropertyValidationRule("creator");
      });

      it("should not provide diagnostics when the property has a value", async () => {
        const wfContents = `{
          "a_galaxy_workflow": "true",
          "creator": [{ "name": "John Doe" }],
        }`;
        const wfDocument = createNativeWorkflowDocument(wfContents);
        const diagnostics = await rule.validate(wfDocument);
        expect(diagnostics).toHaveLength(0);
      });

      it("should provide diagnostics when the property is present but has empty value", async () => {
        const wfContents = `{
          "a_galaxy_workflow": "true",
          "creator": [],
        }`;
        const wfDocument = createNativeWorkflowDocument(wfContents);
        const diagnostics = await rule.validate(wfDocument);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('Missing value in property "creator".');
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      });
    });

    describe("when the property is an object", () => {
      beforeEach(() => {
        rule = new MissingPropertyValidationRule("steps");
      });

      it("should not provide diagnostics when the property has a value", async () => {
        const wfContents = `{
          "a_galaxy_workflow": "true",
          "steps": { "0": { "tool_id": "tool1" } },
        }`;
        const wfDocument = createNativeWorkflowDocument(wfContents);
        const diagnostics = await rule.validate(wfDocument);
        expect(diagnostics).toHaveLength(0);
      });

      it("should provide diagnostics when the property is present but has empty value", async () => {
        const wfContents = `{
          "a_galaxy_workflow": "true",
          "steps": {},
        }`;
        const wfDocument = createNativeWorkflowDocument(wfContents);
        const diagnostics = await rule.validate(wfDocument);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('Missing value in property "steps".');
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      });
    });

    describe("when the property is nested", () => {
      beforeEach(() => {
        rule = new MissingPropertyValidationRule("steps/0/tool_id");
      });

      it("should not provide diagnostics when the property has a value", async () => {
        const wfContents = `{
          "a_galaxy_workflow": "true",
          "steps": { "0": { "tool_id": "tool1" } },
        }`;
        const wfDocument = createNativeWorkflowDocument(wfContents);
        const diagnostics = await rule.validate(wfDocument);
        expect(diagnostics).toHaveLength(0);
      });

      it("should provide diagnostics when the property is missing", async () => {
        const wfContents = `{
          "a_galaxy_workflow": "true",
          "steps": { "0": {} },
        }`;
        const wfDocument = createNativeWorkflowDocument(wfContents);
        const diagnostics = await rule.validate(wfDocument);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('Missing property "steps/0/tool_id".');
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      });

      it("should provide diagnostics when the property is present but has empty value", async () => {
        const wfContents = `{
          "a_galaxy_workflow": "true",
          "steps": { "0": { "tool_id": "" } },
        }`;
        const wfDocument = createNativeWorkflowDocument(wfContents);
        const diagnostics = await rule.validate(wfDocument);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('Missing value in property "steps/0/tool_id".');
        expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      });
    });
  });
});
