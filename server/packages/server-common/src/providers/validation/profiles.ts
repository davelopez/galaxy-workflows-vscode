import { DiagnosticSeverity, ValidationProfile, ValidationRule } from "../../languageTypes";
import { MissingPropertyValidationRule } from "./rules";

/**
 * The *NoOp* validation profile.
 * It doesn't apply any additional custom rules.
 */
export class NoOpValidationProfile implements ValidationProfile {
  protected static readonly NO_RULES = new Set([]);

  public get rules(): Set<ValidationRule> {
    return NoOpValidationProfile.NO_RULES;
  }
}

export const COMMON_IWC_WORKFLOW_RULES = new Set([
  new MissingPropertyValidationRule(
    "release",
    true,
    DiagnosticSeverity.Error,
    "The workflow must have a release version."
  ),
  new MissingPropertyValidationRule(
    "creator",
    true,
    DiagnosticSeverity.Error,
    "The workflow does not specify a creator."
  ),
  new MissingPropertyValidationRule(
    "license",
    true,
    DiagnosticSeverity.Error,
    "The workflow does not specify a license."
  ),
  // Add more common custom rules here...
]);
