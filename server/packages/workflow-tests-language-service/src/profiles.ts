import { DiagnosticSeverity, ValidationProfile, ValidationRule } from "@gxwf/server-common/src/languageTypes";
import { IWCCommonValidationProfile } from "@gxwf/server-common/src/providers/validation/profiles";
import { RequiredArrayPropertyValidationRule } from "@gxwf/server-common/src/providers/validation/rules";
import { WorkflowInputsValidationRule } from "./validation/rules/WorkflowInputsValidationRule";
import { WorkflowOutputsValidationRule } from "./validation/rules/WorkflowOutputsValidationRule";

/**
 * Defines the minimal set of validation rules for Galaxy Workflow Tests Documents.
 */
export class TestDocumentBasicValidationProfile implements ValidationProfile {
  public readonly name: string = "Test Document Validator";
  public static readonly RULES = new Set([
    new WorkflowInputsValidationRule(DiagnosticSeverity.Error),
    new WorkflowOutputsValidationRule(DiagnosticSeverity.Error),
    // Add more custom rules specific to native workflows here...
  ]);

  public get rules(): Set<ValidationRule> {
    return TestDocumentBasicValidationProfile.RULES;
  }
}

/**
 * *Intergalactic Workflow Commission* (IWC) validation profile for Galaxy Workflow Tests Documents.
 * This profile extends the basic validation profile and adds additional rules to comply
 * with the IWC best practices guidelines.
 */
export class TestDocumentIWCValidationProfile extends IWCCommonValidationProfile {
  protected static readonly RULES = new Set([
    ...TestDocumentBasicValidationProfile.RULES,
    new RequiredArrayPropertyValidationRule(
      "doc",
      true,
      DiagnosticSeverity.Warning,
      "The workflow test is not documented. Documenting the tests helps reviewers understand the purpose of the tests."
    ),
    // Add more custom rules specific to native workflows here...
  ]);

  public get rules(): Set<ValidationRule> {
    return TestDocumentIWCValidationProfile.RULES;
  }
}
