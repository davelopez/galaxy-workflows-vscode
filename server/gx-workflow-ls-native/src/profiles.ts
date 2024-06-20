import { DiagnosticSeverity, ValidationRule } from "@gxwf/server-common/src/languageTypes";
import {
  BasicCommonValidationProfile,
  IWCCommonValidationProfile,
} from "@gxwf/server-common/src/providers/validation/profiles";
import { RequiredPropertyValidationRule } from "@gxwf/server-common/src/providers/validation/rules";
import { WorkflowOutputLabelValidationRule } from "./validation/rules/WorkflowOutputLabelValidationRule";

/**
 * Defines the minimal set of validation rules for Native Galaxy workflows.
 */
export class NativeBasicValidationProfile extends BasicCommonValidationProfile {
  public readonly name: string = "Workflow Validation";
  public static readonly RULES = new Set([
    ...super.RULES,
    // Add more custom rules specific to native workflows here...
  ]);

  public get rules(): Set<ValidationRule> {
    return NativeBasicValidationProfile.RULES;
  }
}

/**
 * *Intergalactic Workflow Commission* (IWC) validation profile for Native Galaxy workflows.
 * This profile extends the basic validation profile and adds additional rules to comply
 * with the IWC best practices guidelines.
 */
export class NativeIWCValidationProfile extends IWCCommonValidationProfile {
  protected static readonly RULES = new Set([
    ...super.RULES,
    ...NativeBasicValidationProfile.RULES,
    new RequiredPropertyValidationRule(
      "annotation",
      true,
      DiagnosticSeverity.Error,
      "The workflow is not annotated. Annotating workflows helps users understand the purpose of the workflow."
    ),
    new WorkflowOutputLabelValidationRule(DiagnosticSeverity.Error),
    // Add more custom rules specific to native workflows here...
  ]);

  public get rules(): Set<ValidationRule> {
    return NativeIWCValidationProfile.RULES;
  }
}
