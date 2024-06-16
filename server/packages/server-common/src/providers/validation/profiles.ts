import { DiagnosticSeverity, ValidationProfile, ValidationRule } from "../../languageTypes";
import { RequiredPropertyValidationRule, StepExportErrorValidationRule, TestToolshedValidationRule } from "./rules";

/**
 * The *NoOp* validation profile.
 * It doesn't apply any additional custom rules.
 */
export class NoOpValidationProfile implements ValidationProfile {
  public readonly name: string = "No Validation";
  protected static readonly NO_RULES = new Set([]);

  public get rules(): Set<ValidationRule> {
    return NoOpValidationProfile.NO_RULES;
  }
}

/**
 * Common set of validation rules for basic validation of any workflow format.
 */
export class BasicCommonValidationProfile implements ValidationProfile {
  public readonly name: string = "Basic Validation";

  protected static readonly RULES: Set<ValidationRule> = new Set([
    new TestToolshedValidationRule(DiagnosticSeverity.Error),
    new StepExportErrorValidationRule(DiagnosticSeverity.Error),
    // Add common basic rules here...
  ]);

  public get rules(): Set<ValidationRule> {
    return BasicCommonValidationProfile.RULES;
  }
}

/**
 *  Common set of validation rules for IWC best practices.
 */
export class IWCCommonValidationProfile implements ValidationProfile {
  public readonly name: string = "IWC Best Practices";

  protected static readonly RULES: Set<ValidationRule> = new Set([
    new RequiredPropertyValidationRule(
      "release",
      true,
      DiagnosticSeverity.Error,
      "The workflow must have a release version."
    ),
    new RequiredPropertyValidationRule(
      "creator",
      true,
      DiagnosticSeverity.Error,
      "The workflow does not specify a creator."
    ),
    new RequiredPropertyValidationRule(
      "license",
      true,
      DiagnosticSeverity.Error,
      "The workflow does not specify a license."
    ),
    // Add more common rules here...
  ]);

  public get rules(): Set<ValidationRule> {
    return IWCCommonValidationProfile.RULES;
  }
}
