import { SymbolsProviderBase } from "@gxwf/server-common/src/providers/symbolsProvider";
import { PropertyASTNode } from "@gxwf/yaml-language-service/src/parser/astTypes";
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

  protected getSymbolName(property: PropertyASTNode): string {
    if (this.isStepProperty(property)) {
      return this.getNodeName(property.valueNode) ?? "unnamed";
    }
    return super.getSymbolName(property);
  }
}
