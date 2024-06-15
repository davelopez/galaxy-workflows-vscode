import { DiagnosticSeverity, ValidationRule } from "@gxwf/server-common/src/languageTypes";
import { IWCValidationProfile } from "@gxwf/server-common/src/providers/validation/profiles";
import { MissingPropertyValidationRule } from "@gxwf/server-common/src/providers/validation/rules";

/**
 * *Intergalactic Workflow Commission* (IWC) validation profile for gxformat2 Galaxy workflows.
 * Defines custom validation rules to comply with the IWC best practices guidelines.
 */
export class GxFormat2IWCValidationProfile extends IWCValidationProfile {
  protected static readonly RULES = new Set([
    ...super.RULES,
    new MissingPropertyValidationRule(
      "doc",
      true,
      DiagnosticSeverity.Error,
      "The workflow is not documented. Documenting workflows helps users understand the purpose of the workflow."
    ),
    // Add more custom rules here...
  ]);

  public get rules(): Set<ValidationRule> {
    return GxFormat2IWCValidationProfile.RULES;
  }
}
