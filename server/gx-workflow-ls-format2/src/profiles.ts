import { ValidationRule } from "@gxwf/server-common/src/languageTypes";
import { IWCValidationProfile } from "@gxwf/server-common/src/providers/validation/profiles";

/**
 * *Intergalactic Workflow Commission* (IWC) validation profile for gxformat2 Galaxy workflows.
 * Defines custom validation rules to comply with the IWC best practices guidelines.
 */
export class GxFormat2IWCValidationProfile extends IWCValidationProfile {
  protected static readonly RULES = new Set([
    ...super.RULES,
    // Add more custom rules here...
  ]);

  public get rules(): Set<ValidationRule> {
    return GxFormat2IWCValidationProfile.RULES;
  }
}
