import { DiagnosticSeverity, ValidationProfile, ValidationRule } from "../../languageTypes";
import { MissingPropertyValidationRule } from "./MissingPropertyValidation";
import { WorkflowOutputLabelValidation } from "./WorkflowOutputLabelValidation";

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
    new MissingPropertyValidationRule("release"),
    new WorkflowOutputLabelValidation(DiagnosticSeverity.Error),
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
