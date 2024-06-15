import { DiagnosticSeverity, ValidationRule } from "@gxwf/server-common/src/languageTypes";
import { IWCValidationProfile } from "@gxwf/server-common/src/providers/validation/profiles";
import { WorkflowOutputLabelValidationRule } from "@gxwf/server-common/src/providers/validation/rules";

/**
 * *Intergalactic Workflow Commission* (IWC) validation profile for Native Galaxy workflows.
 * Defines custom validation rules to comply with the IWC best practices guidelines.
 */
export class NativeIWCValidationProfile extends IWCValidationProfile {
  protected static readonly RULES = new Set([
    ...super.RULES,
    new WorkflowOutputLabelValidationRule(DiagnosticSeverity.Error),
    // Add more custom rules here...
  ]);

  public get rules(): Set<ValidationRule> {
    return NativeIWCValidationProfile.RULES;
  }
}
