import { NativeWorkflowSymbolsProvider } from "../../src/services/symbols";
import { createNativeWorkflowDocument } from "../testHelpers";
import { TestWorkflowProvider } from "../testWorkflowProvider";

describe("Native Format Symbols Provider", () => {
  let provider: NativeWorkflowSymbolsProvider;

  beforeEach(() => {
    provider = new NativeWorkflowSymbolsProvider();
  });

  it("should not provide symbols that must be ignored", () => {
    const ignoredSymbols = new Set(["a_galaxy_workflow", "position", "format-version", "version"]);
    const wfContent = TestWorkflowProvider.workflows.validation.withThreeSteps;
    const wfDocument = createNativeWorkflowDocument(wfContent);
    // The ignored nodes exist in the document
    ignoredSymbols.forEach((ignoredSymbol) => {
      const ignoredSymbolExists = wfContent.includes(ignoredSymbol);
      expect(ignoredSymbolExists).toBeTruthy();
    });
    // but they should not be included in the symbols
    const symbols = provider.getSymbols(wfDocument);
    expect(symbols).not.toBeNull();
    symbols.forEach((symbol) => {
      expect(ignoredSymbols.has(symbol.name)).toBeFalsy();
    });
  });

  it("should provide symbols for all steps with names", () => {
    const wfContent = TestWorkflowProvider.workflows.validation.withThreeSteps;
    const wfDocument = createNativeWorkflowDocument(wfContent);
    const symbols = provider.getSymbols(wfDocument);
    expect(symbols).not.toBeNull();
    const stepsSymbol = symbols.find((symbol) => symbol.name === "steps");
    expect(stepsSymbol).toBeDefined();
    expect(stepsSymbol?.children).toBeDefined();
    expect(stepsSymbol?.children?.length).toBe(3);
    const stepNames = ["Input dataset", "Input dataset", "Concatenate datasets"];
    stepsSymbol?.children?.forEach((step, i) => {
      expect(step.name).toBe(stepNames[i]);
    });
  });
});
