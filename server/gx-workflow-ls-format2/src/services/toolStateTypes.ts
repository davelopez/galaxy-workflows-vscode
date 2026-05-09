/**
 * Re-exports for format2 tool-state services.
 * Shared helpers live in server-common/providers/validation/toolStateAstHelpers.ts.
 */

// ---------------------------------------------------------------------------
// Schema types not re-exported by server-common
// ---------------------------------------------------------------------------

export type {
  BooleanParameterModel as BooleanParam,
  ConditionalParameterModel as ConditionalParam,
  ConditionalWhen,
  LabelValue as SelectOption,
  RepeatParameterModel as RepeatParam,
  SectionParameterModel as SectionParam,
  SelectParameterModel,
  GenomeBuildParameterModel,
} from "@galaxy-tool-util/schema";

export { isBooleanParam, isConditionalParam, isRepeatParam, isSectionParam } from "@galaxy-tool-util/schema";

// ---------------------------------------------------------------------------
// Shared helpers from server-common
// ---------------------------------------------------------------------------

export type {
  ToolParam,
  ToolParamBase,
  SelectParam,
} from "@gxwf/server-common/src/providers/validation/toolStateAstHelpers";

export {
  isHidden,
  isSelectParam,
  buildParamHoverMarkdown,
  getStringPropertyFromStep,
  getObjectNodeFromStep,
} from "@gxwf/server-common/src/providers/validation/toolStateAstHelpers";
