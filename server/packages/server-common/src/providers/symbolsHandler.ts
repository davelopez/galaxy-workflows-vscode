import { ASTNode, ObjectASTNode, PropertyASTNode } from "../ast/types";
import {
  DocumentContext,
  DocumentSymbol,
  DocumentSymbolParams,
  GalaxyWorkflowLanguageServer,
  SymbolKind,
} from "../languageTypes";
import { ServerEventHandler } from "./handler";

const IGNORE_SYMBOL_NAMES = new Set(["a_galaxy_workflow", "position", "uuid", "errors", "format-version", "version"]);

export class SymbolsHandler extends ServerEventHandler {
  public static register(server: GalaxyWorkflowLanguageServer): SymbolsHandler {
    return new SymbolsHandler(server);
  }

  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
    this.server.connection.onDocumentSymbol((params) => this.onDocumentSymbol(params));
  }

  public onDocumentSymbol(params: DocumentSymbolParams): DocumentSymbol[] {
    const documentContext = this.server.documentsCache.get(params.textDocument.uri);
    if (documentContext) {
      const symbols = this.getSymbols(documentContext);
      return symbols;
    }
    return [];
  }

  private getSymbols(documentContext: DocumentContext): DocumentSymbol[] {
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
            const name = this.getNodeName(node) || String(index);
            if (IGNORE_SYMBOL_NAMES.has(name)) {
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
            if (IGNORE_SYMBOL_NAMES.has(name)) {
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
        return SymbolKind.Module;
      case "string":
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

  private getKeyLabel(property: PropertyASTNode): string {
    let name = String(property.keyNode.value);
    if (name) {
      name = name.replace(/[\n]/g, "↵");
    }
    if (name && name.trim()) {
      return name;
    }
    return `"${name}"`;
  }

  private getDetail(node: ASTNode | undefined): string | undefined {
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
