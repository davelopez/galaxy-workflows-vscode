import type { ASTNode } from "./types";

export function getPathSegments(path: string): string[] | null {
  const segments = path.split(/[/.]/);
  // Skip leading `/` or `.`
  if (!segments[0]) return segments.slice(1);
  return segments;
}

/**
 * Convert an AST node into the plain JS value it represents, discarding
 * position information. Mirrors the structure jsonc/YAML parsers produce, so
 * the result can be fed to value-based helpers (e.g. the gxformat2 step
 * shorthand normalizers) that have no AST awareness.
 */
export function getNodeValue(node: ASTNode): unknown {
  switch (node.type) {
    case "object": {
      const obj: Record<string, unknown> = {};
      for (const prop of node.properties) {
        if (prop.valueNode) obj[String(prop.keyNode.value)] = getNodeValue(prop.valueNode);
      }
      return obj;
    }
    case "array":
      return node.items.map(getNodeValue);
    case "string":
    case "number":
    case "boolean":
      return node.value;
    case "null":
      return null;
    default:
      return undefined;
  }
}

export function getPropertyNodeFromPath(root: ASTNode, path: string): ASTNode | null {
  let segments = getPathSegments(path);
  if (!segments) return null;
  if (segments.length === 1 && !segments[0]) return null;
  let currentNode = root;
  while (segments.length) {
    const segment = segments[0];
    segments = segments?.slice(1);
    const isLast = !segments.length;
    if (currentNode.type == "object") {
      const property = currentNode.properties.find((p) => p.keyNode.value == segment);
      if (property && isLast) return property;
      if (!property?.valueNode) return null;
      if (property.valueNode.type == "object") {
        currentNode = property.valueNode;
      } else if (property.valueNode.type == "array") {
        currentNode = property.valueNode;
      } else {
        return null;
      }
    } else if (currentNode.type == "array") {
      const index = Number(segment);
      const itemAtIndex = currentNode.items.at(index);
      if (itemAtIndex) {
        currentNode = itemAtIndex;
      } else {
        return null;
      }
    }
  }
  return currentNode;
}
