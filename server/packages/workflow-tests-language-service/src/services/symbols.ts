import { ASTNode } from "@gxwf/server-common/src/ast/types";
import { SymbolKind } from "@gxwf/server-common/src/languageTypes";
import { SymbolsProviderBase } from "@gxwf/server-common/src/providers/symbolsProvider";
import { injectable } from "inversify";

@injectable()
export class WorkflowTestsSymbolsProvider extends SymbolsProviderBase {
  constructor() {
    super();
    this.stepContainerNames = new Set(["job", "outputs"]);
  }

  protected override getArrayNodeName(node: ASTNode | undefined, index: number): string {
    const isTopNode = node?.parent?.parent === undefined;
    return this.getNodeName(node) ?? isTopNode ? `Test ${index + 1}` : String(index);
  }

  protected override getSymbolKind(nodeType: string): SymbolKind {
    if (
      nodeType.startsWith("has_") ||
      nodeType.startsWith("is_") ||
      nodeType.endsWith("_is") ||
      nodeType.endsWith("_matches") ||
      nodeType.startsWith("can_")
    ) {
      return SymbolKind.Boolean;
    }
    switch (nodeType) {
      case "doc":
        return SymbolKind.String;
      case "job":
      case "elements":
      case "element_tests":
      case "asserts":
        return SymbolKind.Array;
      case "n":
      case "max":
      case "min":
      case "delta":
        return SymbolKind.Number;
      case "path":
        return SymbolKind.File;
      case "expression":
        return SymbolKind.Function;
      case "filetype":
      case "collection_type":
        return SymbolKind.Enum;
    }
    return super.getSymbolKind(nodeType);
  }
}
