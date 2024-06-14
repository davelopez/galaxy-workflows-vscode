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

  it("should return symbols for each test", () => {
    const content = `
- doc: a test
  job:
    input_1:
      class: File
      path: a
    input 2: b
    'input:3': c`;
    const symbols = getSymbols(content);
    expect(symbols.length).toBe(1);
    const testSymbol = symbols[0];
    expect(testSymbol.name).toBe("Test 1");
    expect(testSymbol.children?.length).toBe(2);
    expect(testSymbol.children?.at(0)?.name).toBe("doc");
    const jobSymbol = testSymbol.children?.at(1);
    expect(jobSymbol?.name).toBe("job");
    expect(jobSymbol?.children?.length).toBe(3);
    expect(jobSymbol?.children?.at(0)?.name).toBe("input_1");
    expect(jobSymbol?.children?.at(1)?.name).toBe("input 2");
    expect(jobSymbol?.children?.at(2)?.name).toBe("input:3");
  });
});
