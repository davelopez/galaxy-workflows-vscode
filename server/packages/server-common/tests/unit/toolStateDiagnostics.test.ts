import { DiagnosticSeverity, type Range } from "vscode-languageserver-types";
import type { ToolStateDiagnostic } from "../../src/languageTypes";
import {
  buildCacheMissDiagnostic,
  mapToolStateDiagnosticsToLSP,
} from "../../src/providers/validation/toolStateDiagnostics";

const RANGE = { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } };
const KEY_RANGE = { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } };
const VALUE_RANGE = { start: { line: 1, character: 7 }, end: { line: 1, character: 15 } };

// ---------------------------------------------------------------------------
// buildCacheMissDiagnostic
// ---------------------------------------------------------------------------

describe("buildCacheMissDiagnostic", () => {
  it("returns Information when tool not cached and no resolution failure", () => {
    const diag = buildCacheMissDiagnostic("my_tool", false, RANGE);
    expect(diag.severity).toBe(DiagnosticSeverity.Information);
    expect(diag.message).toContain("not in the local cache");
    expect(diag.message).toContain("my_tool");
    expect(diag.range).toBe(RANGE);
  });

  it("returns Warning when resolution failed", () => {
    const diag = buildCacheMissDiagnostic("my_tool", true, RANGE);
    expect(diag.severity).toBe(DiagnosticSeverity.Warning);
    expect(diag.message).toContain("Could not resolve tool");
    expect(diag.message).toContain("my_tool");
  });
});

// ---------------------------------------------------------------------------
// mapToolStateDiagnosticsToLSP
// ---------------------------------------------------------------------------

describe("mapToolStateDiagnosticsToLSP", () => {
  function resolver(_path: string, target: "key" | "value"): Range {
    return target === "key" ? KEY_RANGE : VALUE_RANGE;
  }

  it("returns empty array for empty input", () => {
    expect(mapToolStateDiagnosticsToLSP([], resolver)).toHaveLength(0);
  });

  it("maps excess-property diagnostic to Warning at key range", () => {
    const raw: ToolStateDiagnostic[] = [{ path: "bad_param", message: "bad_param is unexpected", severity: "warning" }];
    const diags = mapToolStateDiagnosticsToLSP(raw, resolver);
    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe(DiagnosticSeverity.Warning);
    expect(diags[0].message).toContain("Unknown tool parameter 'bad_param'");
    expect(diags[0].range).toBe(KEY_RANGE);
  });

  it("maps value-error diagnostic to Error at value range", () => {
    const raw: ToolStateDiagnostic[] = [{ path: "mode", message: 'Expected "fast", actual "slow"', severity: "error" }];
    const diags = mapToolStateDiagnosticsToLSP(raw, resolver);
    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe(DiagnosticSeverity.Error);
    expect(diags[0].message).toContain("Invalid value 'slow'");
    expect(diags[0].message).toContain("fast");
    expect(diags[0].range).toBe(VALUE_RANGE);
  });

  it("merges multiple union-error messages for same path into one diagnostic", () => {
    const raw: ToolStateDiagnostic[] = [
      { path: "mode", message: 'Expected "fast", actual "slow"', severity: "error" },
      { path: "mode", message: 'Expected "sensitive", actual "slow"', severity: "error" },
    ];
    const diags = mapToolStateDiagnosticsToLSP(raw, resolver);
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain("fast");
    expect(diags[0].message).toContain("sensitive");
  });

  it("uses leaf key as parameter name in messages", () => {
    const raw: ToolStateDiagnostic[] = [
      { path: "section.subsection.leaf_key", message: "leaf_key is unexpected", severity: "warning" },
    ];
    const diags = mapToolStateDiagnosticsToLSP(raw, resolver);
    expect(diags[0].message).toContain("'leaf_key'");
  });
});
