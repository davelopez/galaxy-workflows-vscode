import { DiagnosticSeverity, ValidationProfile, ValidationRule } from "@gxwf/server-common/src/languageTypes";
import { COMMON_IWC_WORKFLOW_RULES } from "@gxwf/server-common/src/providers/validation/profiles";
import { WorkflowOutputLabelValidation } from "@gxwf/server-common/src/providers/validation/rules";

/**
 * *Intergalactic Workflow Commission* (IWC) validation profile for Native Galaxy workflows.
 * Defines custom validation rules to comply with the IWC best practices guidelines.
 */
export class NativeIWCValidationProfile implements ValidationProfile {
  protected static readonly RULES = new Set([
    ...COMMON_IWC_WORKFLOW_RULES,
    new WorkflowOutputLabelValidation(DiagnosticSeverity.Error),
    // Add more custom rules here...
  ]);

  public get rules(): Set<ValidationRule> {
    return NativeIWCValidationProfile.RULES;
  }
}
