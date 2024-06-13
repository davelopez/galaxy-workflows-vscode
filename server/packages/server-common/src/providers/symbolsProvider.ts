import { injectable } from "inversify";
import { ASTNode, ObjectASTNode, PropertyASTNode } from "../ast/types";
import { DocumentContext, DocumentSymbol, SymbolKind, SymbolsProvider } from "../languageTypes";

@injectable()
export class SymbolsProviderBase implements SymbolsProvider {
  /**
   * Set of symbol names to ignore when generating the outline.
   * This is useful to avoid showing internal properties in the outline.
   */
  protected symbolNamesToIgnore = new Set<string>();

  /**
   * Set of property names that are considered containers of steps.
   * This is useful to determine if a property is a step, input, or output.
   */
  protected stepContainerNames = new Set<string>();

  public getSymbols(documentContext: DocumentContext): DocumentSymbol[] {
    const root = documentContext.nodeManager.root;
    if (!root) {
      return [];
    }
    const result: DocumentSymbol[] = [];
    const toVisit: { node: ASTNode; result: DocumentSymbol[] }[] = [{ node: root, result }];
    let nextToVisit = 0;

    const collectOutlineEntries = (node: ASTNode, result: DocumentSymbol[]): void => {
      if (node.type === "array") {
        node.items.forEach((node, index) => {
          if (node) {
            const name = this.getArrayNodeName(node, index);
            if (this.symbolNamesToIgnore.has(name)) {
              return;
            }
            const range = documentContext.nodeManager.getNodeRange(node);
            const selectionRange = range;
            const symbol = { name, kind: this.getSymbolKind(node.type), range, selectionRange, children: [] };
            result.push(symbol);
            toVisit.push({ result: symbol.children, node });
          }
        });
      } else if (node.type === "object") {
        node.properties.forEach((property: PropertyASTNode) => {
          const valueNode = property.valueNode;
          if (valueNode) {
            let name = undefined;
            let customSymbol = undefined;
            if (this.isStepProperty(property)) {
              name = this.getNodeName(property.valueNode);
              customSymbol = "step";
            }
            name = name || this.getKeyLabel(property);
            customSymbol = customSymbol || name;
            if (this.symbolNamesToIgnore.has(name)) {
              return;
            }
            const range = documentContext.nodeManager.getNodeRange(property);
            const selectionRange = documentContext.nodeManager.getNodeRange(property.keyNode);
            const children: DocumentSymbol[] = [];
            const symbol: DocumentSymbol = {
              name: name,
              kind: this.getSymbolKind(customSymbol),
              range,
              selectionRange,
              children,
              detail: this.getDetail(valueNode),
            };
            result.push(symbol);
            toVisit.push({ result: children, node: valueNode });
          }
        });
      }
    };

    while (nextToVisit < toVisit.length) {
      const next = toVisit[nextToVisit++];
      collectOutlineEntries(next.node, next.result);
    }
    return result;
  }

  protected isStepProperty(property: PropertyASTNode | undefined): boolean {
    // The direct parent is the object containing this property and we want
    // to check the "steps" property which is the parent of that object
    const grandParent = property?.parent?.parent;
    if (grandParent && grandParent.type === "property") {
      const name = this.getKeyLabel(grandParent);
      return this.stepContainerNames.has(name);
    }
    return false;
  }

  protected getSymbolKind(nodeType: string): SymbolKind {
    switch (nodeType) {
      case "step":
      case "subworkflow":
        return SymbolKind.Function;
      case "tool_id":
        return SymbolKind.Property;
      case "type":
        return SymbolKind.TypeParameter;
      case "class":
        return SymbolKind.Class;
      case "object":
        return SymbolKind.Object;
      case "string":
      case "text":
        return SymbolKind.String;
      case "annotation":
      case "description":
        return SymbolKind.Key;
      case "id":
      case "number":
      case "identifier":
        return SymbolKind.Number;
      case "steps":
      case "inputs":
      case "outputs":
      case "array":
        return SymbolKind.Array;
      case "boolean":
      case "when":
        return SymbolKind.Boolean;
      case "value":
        return SymbolKind.Variable;
      case "null":
        return SymbolKind.Null;
      default:
        return SymbolKind.Field;
    }
  }

  protected getNodeName(node: ASTNode | undefined): string | undefined {
    if (node && node.type === "object") {
      return this.getPropertyValueAsString(node, "name") || this.getPropertyValueAsString(node, "label");
    } else if (node && node.type === "string") {
      return node.value;
    }
    return undefined;
  }

  protected getArrayNodeName(node: ASTNode | undefined, index: number): string {
    return this.getNodeName(node) ?? String(index);
  }

  protected getPropertyValueAsString(node: ObjectASTNode, propertyName: string): string | undefined {
    const nameProp = node.properties.find((p) => !!p.valueNode?.value && p.keyNode.value === propertyName);
    if (nameProp) {
      return nameProp.valueNode?.value?.toString();
    }
    return undefined;
  }

  protected getKeyLabel(property: PropertyASTNode): string {
    let name = String(property.keyNode.value);
    if (name) {
      name = name.replace(/[\n]/g, "↵");
    }
    if (name && name.trim()) {
      return name;
    }
    return `"${name}"`;
  }

  protected getDetail(node: ASTNode | undefined): string | undefined {
    if (!node) {
      return undefined;
    }
    if (node.type === "boolean" || node.type === "number" || node.type === "null" || node.type === "string") {
      return String(node.value);
    } else {
      if (node.type === "array") {
        return node.children.length ? undefined : "[]";
      } else if (node.type === "object") {
        return node.children.length ? undefined : "{}";
      }
    }
    return undefined;
  }
}
