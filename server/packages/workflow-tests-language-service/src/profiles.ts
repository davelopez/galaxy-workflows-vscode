import { DiagnosticSeverity, ValidationRule } from "@gxwf/server-common/src/languageTypes";
import {
  BasicCommonValidationProfile,
  IWCCommonValidationProfile,
} from "@gxwf/server-common/src/providers/validation/profiles";
import { MissingPropertyValidationRule } from "@gxwf/server-common/src/providers/validation/rules";
import { WorkflowInputsValidationRule } from "./validation/rules/WorkflowInputsValidationRule";
import { WorkflowOutputsValidationRule } from "./validation/rules/WorkflowOutputsValidationRule";

/**
 * Defines the minimal set of validation rules for Native Galaxy workflows.
 */
export class TestDocumentBasicValidationProfile extends BasicCommonValidationProfile {
  public static readonly RULES = new Set([
    ...super.RULES,
    new WorkflowInputsValidationRule(DiagnosticSeverity.Error),
    new WorkflowOutputsValidationRule(DiagnosticSeverity.Error),
    // Add more custom rules specific to native workflows here...
  ]);

  public get rules(): Set<ValidationRule> {
    return TestDocumentBasicValidationProfile.RULES;
  }
}

/**
 * *Intergalactic Workflow Commission* (IWC) validation profile for Native Galaxy workflows.
 * This profile extends the basic validation profile and adds additional rules to comply
 * with the IWC best practices guidelines.
 */
export class TestDocumentIWCValidationProfile extends IWCCommonValidationProfile {
  protected static readonly RULES = new Set([
    ...super.RULES,
    ...TestDocumentBasicValidationProfile.RULES,
    new MissingPropertyValidationRule(
      "doc",
      true,
      DiagnosticSeverity.Error,
      "The workflow is not documented. Documenting workflows helps users understand the purpose of the workflow."
    ),
    // Add more custom rules specific to native workflows here...
  ]);

  public get rules(): Set<ValidationRule> {
    return TestDocumentIWCValidationProfile.RULES;
  }
}
