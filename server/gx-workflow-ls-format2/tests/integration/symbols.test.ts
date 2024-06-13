import { DocumentSymbol } from "@gxwf/server-common/src/languageTypes";

import "reflect-metadata";
import { GxFormat2WorkflowSymbolsProvider } from "../../src/services/symbols";
import { createFormat2WorkflowDocument } from "../testHelpers";

describe("Format2 Workflow Symbols Provider", () => {
  let provider: GxFormat2WorkflowSymbolsProvider;
  beforeAll(() => {
    provider = new GxFormat2WorkflowSymbolsProvider();
  });

  function getSymbols(contents: string): DocumentSymbol[] {
    const documentContext = createFormat2WorkflowDocument(contents);
    return provider.getSymbols(documentContext);
  }

  it("should return symbols for a workflow", () => {
    const content = `
class: GalaxyWorkflow
inputs:
  input_1: data
  input_2:
    type: File
    doc: This is the input 2
  the_collection:
    type: collection
    doc: This is a collection
  input_int: integer
  text_param:
    optional: true
    default: text value
    restrictOnConnections: true
    type: text
    `;
    const symbols = getSymbols(content);
    expect(symbols.length).toBe(2);
    const classSymbol = symbols[0];
    expect(classSymbol.name).toBe("class");
    expect(classSymbol.detail).toBe("GalaxyWorkflow");
    const inputsSymbol = symbols[1];
    expect(inputsSymbol.name).toBe("inputs");
    expect(inputsSymbol.children?.length).toBe(5);
    expect(inputsSymbol.children?.at(0)?.name).toBe("input_1");
    expect(inputsSymbol.children?.at(1)?.name).toBe("input_2");
    expect(inputsSymbol.children?.at(2)?.name).toBe("the_collection");
    expect(inputsSymbol.children?.at(3)?.name).toBe("input_int");
    expect(inputsSymbol.children?.at(4)?.name).toBe("text_param");
  });
});
