import { DocumentSymbol } from "@gxwf/server-common/src/languageTypes";

import "reflect-metadata";
import { WorkflowTestsSymbolsProvider } from "../../src/services/symbols";
import { createGxWorkflowTestsDocument } from "../testHelpers";

describe("Format2 Workflow Symbols Provider", () => {
  let provider: WorkflowTestsSymbolsProvider;
  beforeAll(() => {
    provider = new WorkflowTestsSymbolsProvider();
  });

  function getSymbols(contents: string): DocumentSymbol[] {
    const documentContext = createGxWorkflowTestsDocument(contents);
    return provider.getSymbols(documentContext);
  }

  it("should return top level symbols as 'Test {index+1}'", () => {
    const content = `
- doc: a test
- job:
- doc: another test
    `;
    const symbols = getSymbols(content);
    expect(symbols.length).toBe(3);
    expect(symbols[0].name).toBe("Test 1");
    expect(symbols[1].name).toBe("Test 2");
    expect(symbols[2].name).toBe("Test 3");
  });
});
