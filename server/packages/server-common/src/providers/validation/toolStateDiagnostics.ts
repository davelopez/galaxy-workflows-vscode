import type { ToolStateDiagnostic } from "@galaxy-tool-util/schema";
import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver-types";

/** Diagnostic code attached to all Pass B (string-encoded tool_state) diagnostics.
 *  Used by CodeActionHandler to offer a "Clean workflow" quick fix. */
export const LEGACY_TOOL_STATE_CODE = "legacy-tool-state";

/**
 * Hint diagnostic emitted for every step with string-encoded tool_state (Pass B).
 * Surfaces the "Clean workflow" quick fix even when there are no param errors.
 */
export function buildLegacyToolStateHintDiagnostic(range: Range): Diagnostic {
  return {
    message: "tool_state is JSON-encoded string. Clean workflow to enable completions, hover, and precise diagnostics.",
    range,
    severity: DiagnosticSeverity.Hint,
    code: LEGACY_TOOL_STATE_CODE,
  };
}

/**
 * Build a "not cached" or "resolution failed" diagnostic pointing at toolIdNode.
 */
export function buildCacheMissDiagnostic(toolId: string, hasFailed: boolean, range: Range): Diagnostic {
  if (hasFailed) {
    return {
      message: `Could not resolve tool '${toolId}' from ToolShed — see Output panel.`,
      range,
      severity: DiagnosticSeverity.Warning,
    };
  }
  return {
    message: `Tool '${toolId}' is not in the local cache. Run 'Populate Tool Cache' to enable tool state validation.`,
    range,
    severity: DiagnosticSeverity.Information,
  };
}

/**
 * Convert ToolStateDiagnostic[] to LSP Diagnostic[].
 *
 * Groups by path and merges union errors into a single message.
 * The `resolveRange` callback maps a dot-path + "key"|"value" to an LSP Range.
 * - Format2 provides a YAML-AST walker.
 * - Native object pass provides the same walker (JSON AST, same interface).
 * - Native string pass returns the whole string node range for every path.
 */
export function mapToolStateDiagnosticsToLSP(
  rawDiags: ToolStateDiagnostic[],
  resolveRange: (path: string, target: "key" | "value") => Range
): Diagnostic[] {
  const groups = new Map<string, ToolStateDiagnostic[]>();
  for (const d of rawDiags) {
    const bucket = groups.get(d.path) ?? [];
    bucket.push(d);
    groups.set(d.path, bucket);
  }

  const result: Diagnostic[] = [];
  for (const [path, diags] of groups) {
    if (diags.some((d) => d.message.includes("is unexpected"))) {
      const leafKey = path.split(".").at(-1) ?? path;
      result.push({
        message: `Unknown tool parameter '${leafKey}'.`,
        range: resolveRange(path, "key"),
        severity: DiagnosticSeverity.Warning,
      });
    } else {
      const expectedValues: string[] = [];
      let actualValue: string | undefined;
      for (const d of diags) {
        const expMatch = d.message.match(/Expected "([^"]+)"/);
        if (expMatch && expMatch[1] !== "undefined") expectedValues.push(expMatch[1]);
        if (!actualValue) {
          const actMatch = d.message.match(/actual "([^"]+)"/);
          if (actMatch) actualValue = actMatch[1];
        }
      }

      const paramName = path.split(".").at(-1) ?? path;
      const message =
        actualValue && expectedValues.length > 0
          ? `Invalid value '${actualValue}' for '${paramName}'. Must be one of: ${expectedValues.join(", ")}.`
          : diags[0].message;

      result.push({
        message,
        range: resolveRange(path, "value"),
        severity: DiagnosticSeverity.Error,
      });
    }
  }
  return result;
}
