import { DiagnosticSeverity, ValidationRule } from "@gxwf/server-common/src/languageTypes";
import {
  BasicCommonValidationProfile,
  IWCCommonValidationProfile,
} from "@gxwf/server-common/src/providers/validation/profiles";
import { MissingPropertyValidationRule } from "@gxwf/server-common/src/providers/validation/rules";

/**
 * Defines the minimal set of validation rules for gxformat2 Galaxy workflows.
 */
export class GxFormat2BasicValidationProfile extends BasicCommonValidationProfile {
  public static readonly RULES = new Set([
    ...super.RULES,
    // Add more custom rules specific to gxformat2 workflows here...
  ]);

  public get rules(): Set<ValidationRule> {
    return GxFormat2BasicValidationProfile.RULES;
  }
}

/**
 * *Intergalactic Workflow Commission* (IWC) validation profile for gxformat2 Galaxy workflows.
 * This profile extends the basic validation profile and adds additional rules to comply
 * with the IWC best practices guidelines.
 */
export class GxFormat2IWCValidationProfile extends IWCCommonValidationProfile {
  protected static readonly RULES = new Set([
    ...super.RULES,
    ...GxFormat2BasicValidationProfile.RULES,
    new MissingPropertyValidationRule(
      "doc",
      true,
      DiagnosticSeverity.Error,
      "The workflow is not documented. Documenting workflows helps users understand the purpose of the workflow."
    ),
    // Add more custom rules specific to gxformat2 workflows here...
  ]);

  public get rules(): Set<ValidationRule> {
    return GxFormat2IWCValidationProfile.RULES;
  }
}
