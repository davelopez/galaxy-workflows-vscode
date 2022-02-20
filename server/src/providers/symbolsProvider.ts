import { getRange } from "../languageService";
import {
  TextDocument,
  DocumentSymbolParams,
  DocumentSymbol,
  SymbolKind,
  ASTNode,
  PropertyASTNode,
  ObjectASTNode,
} from "../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../server";
import { Provider } from "./provider";

export class SymbolsProvider extends Provider {
  public static register(server: GalaxyWorkflowLanguageServer): SymbolsProvider {
    return new SymbolsProvider(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.connection.onDocumentSymbol((params) => this.onDocumentSymbol(params));
  }

  public onDocumentSymbol(params: DocumentSymbolParams): DocumentSymbol[] {
    const workflowDocument = this.workflowDocuments.get(params.textDocument.uri);
    if (workflowDocument) {
      const symbols = this.getSymbols(workflowDocument.textDocument, workflowDocument.jsonDocument.root);
      return symbols;
    }
    return [];
  }

  private getSymbols(document: TextDocument, root: ASTNode | undefined): DocumentSymbol[] {
    if (!root) {
      return [];
    }
    const result: DocumentSymbol[] = [];
    const toVisit: { node: ASTNode; result: DocumentSymbol[] }[] = [{ node: root, result }];
    let nextToVisit = 0;

    const collectOutlineEntries = (node: ASTNode, result: DocumentSymbol[]) => {
      if (node.type === "array") {
        node.items.forEach((node, index) => {
          if (node) {
            const range = getRange(document, node);
            const selectionRange = range;
            const name = this.getNodeName(node) || String(index);
            const symbol = { name, kind: this.getSymbolKind(node.type), range, selectionRange, children: [] };
            result.push(symbol);
            toVisit.push({ result: symbol.children, node });
          }
        });
      } else if (node.type === "object") {
        node.properties.forEach((property: PropertyASTNode) => {
          const valueNode = property.valueNode;
          if (valueNode) {
            const name = this.isStepProperty(property)
              ? this.getNodeName(property.valueNode)
              : this.getKeyLabel(property);

            const range = getRange(document, property);
            const selectionRange = getRange(document, property.keyNode);
            const children: DocumentSymbol[] = [];
            const symbol: DocumentSymbol = {
              name: name || this.getKeyLabel(property),
              kind: this.getSymbolKind(valueNode.type),
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

  private isStepProperty(property: PropertyASTNode | undefined): boolean {
    // The direct parent is the object containing this property and we want
    // to check the "steps" property which is the parent of that object
    const grandParent = property?.parent?.parent;
    if (grandParent && grandParent.type === "property") {
      const name = this.getKeyLabel(grandParent);
      return name === "steps";
    }
    return false;
  }

  private getSymbolKind(nodeType: string): SymbolKind {
    switch (nodeType) {
      case "object":
        return SymbolKind.Module;
      case "string":
        return SymbolKind.String;
      case "number":
        return SymbolKind.Number;
      case "array":
        return SymbolKind.Array;
      case "boolean":
        return SymbolKind.Boolean;
      default:
        return SymbolKind.Variable;
    }
  }

  private getNodeName(node: ASTNode | undefined): string | undefined {
    if (node && node.type === "object") {
      return this.getPropertyValueAsString(node, "name") || this.getPropertyValueAsString(node, "label");
    } else if (node && node.type === "string") {
      return node.value;
    }
    return undefined;
  }

  private getPropertyValueAsString(node: ObjectASTNode, propertyName: string): string | undefined {
    const nameProp = node.properties.find((p) => !!p.valueNode?.value && p.keyNode.value === propertyName);
    if (nameProp) {
      return nameProp.valueNode?.value?.toString();
    }
    return undefined;
  }

  private getKeyLabel(property: PropertyASTNode) {
    let name = property.keyNode.value;
    if (name) {
      name = name.replace(/[\n]/g, "↵");
    }
    if (name && name.trim()) {
      return name;
    }
    return `"${name}"`;
  }

  private getDetail(node: ASTNode | undefined) {
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
