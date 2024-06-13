import { SymbolKind } from "@gxwf/server-common/src/languageTypes";
import { SymbolsProviderBase } from "@gxwf/server-common/src/providers/symbolsProvider";
import { injectable } from "inversify";

@injectable()
export class GxFormat2WorkflowSymbolsProvider extends SymbolsProviderBase {
  constructor() {
    super();
    this.stepContainerNames = new Set(["inputs", "outputs", "steps"]);
  }

  protected override getSymbolKind(nodeType: string): SymbolKind {
    switch (nodeType) {
      case "doc":
        return SymbolKind.String;
      case "path":
        return SymbolKind.File;
    }
    return super.getSymbolKind(nodeType);
  }
}
