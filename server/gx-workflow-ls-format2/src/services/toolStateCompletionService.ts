/**
 * Re-exports for backward compat.
 * The real implementations now live in server-common/providers/toolStateCompletion.ts.
 */
export type { StateInPath, CompletionTextContext } from "@gxwf/server-common/src/providers/toolStateCompletion";
export {
  findStateInPath,
  getCompletionTextContext,
  ToolStateCompletionService,
} from "@gxwf/server-common/src/providers/toolStateCompletion";
