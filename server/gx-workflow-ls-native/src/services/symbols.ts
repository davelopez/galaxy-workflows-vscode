import { SymbolsProviderBase } from "@gxwf/server-common/src/providers/symbolsProvider";
import { injectable } from "inversify";

@injectable()
export class NativeWorkflowSymbolsProvider extends SymbolsProviderBase {
  constructor() {
    super();
    this.symbolNamesToIgnore = new Set([
      "a_galaxy_workflow",
      "position",
      "uuid",
      "errors",
      "format-version",
      "version",
    ]);
    this.stepContainerNames = new Set(["steps"]);
  }
}
