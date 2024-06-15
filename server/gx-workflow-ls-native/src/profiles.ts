import { DiagnosticSeverity, ValidationRule } from "@gxwf/server-common/src/languageTypes";
import { IWCValidationProfile } from "@gxwf/server-common/src/providers/validation/profiles";
import { MissingPropertyValidationRule } from "@gxwf/server-common/src/providers/validation/rules";
import { WorkflowOutputLabelValidationRule } from "./validation/rules/WorkflowOutputLabelValidation";

/**
 * *Intergalactic Workflow Commission* (IWC) validation profile for Native Galaxy workflows.
 * Defines custom validation rules to comply with the IWC best practices guidelines.
 */
export class NativeIWCValidationProfile extends IWCValidationProfile {
  protected static readonly RULES = new Set([
    ...super.RULES,
    new MissingPropertyValidationRule(
      "annotation",
      true,
      DiagnosticSeverity.Error,
      "The workflow is not annotated. Annotating workflows helps users understand the purpose of the workflow."
    ),
    new WorkflowOutputLabelValidationRule(DiagnosticSeverity.Error),
    // Add more custom rules here...
  ]);

  public get rules(): Set<ValidationRule> {
    return NativeIWCValidationProfile.RULES;
  }
}
