import { ASTNode } from "@gxwf/server-common/src/languageTypes";

export function getPathSegments(path: string): string[] | null {
  const segments = path.split(/[/.]/);
  // Skip leading `/` or `.`
  if (!segments[0]) return segments.slice(1);
  return segments;
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
