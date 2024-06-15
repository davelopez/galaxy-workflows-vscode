import { DiagnosticSeverity, ValidationProfile, ValidationRule } from "../../languageTypes";
import { MissingPropertyValidationRule, WorkflowOutputLabelValidation } from "./rules";

/**
 * The default validation profile.
 * It doesn't apply any additional custom rules.
 */
export class BasicValidationProfile implements ValidationProfile {
  protected static readonly ID = "basic";
  protected static readonly NO_RULES = new Set([]);

  public get id(): string {
    return BasicValidationProfile.ID;
  }

  public get rules(): Set<ValidationRule> {
    return BasicValidationProfile.NO_RULES;
  }
}

/**
 * *Intergalactic Workflow Commission* (IWC) validation profile.
 * Defines custom validation rules to comply with the IWC best practices guidelines.
 */
export class IWCValidationProfile implements ValidationProfile {
  protected static readonly ID = "iwc";
  protected static readonly RULES = new Set([
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
    new WorkflowOutputLabelValidation(DiagnosticSeverity.Error),
    // Add more custom rules here...
  ]);

  public get id(): string {
    return IWCValidationProfile.ID;
  }

  public get rules(): Set<ValidationRule> {
    return IWCValidationProfile.RULES;
  }
}

/** Contains all the available validation profiles. */
export const ValidationProfiles = new Map<string, ValidationProfile>([
  ["basic", new BasicValidationProfile()],
  ["iwc", new IWCValidationProfile()],
]);
