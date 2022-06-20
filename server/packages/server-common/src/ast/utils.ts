import { ASTNode } from "./types";

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

export function contains(node: ASTNode, offset: number, includeRightBound = false): boolean {
  return (
    (offset >= node.offset && offset <= node.offset + node.length) ||
    (includeRightBound && offset === node.offset + node.length)
  );
}

export function findNodeAtOffset(node: ASTNode, offset: number, includeRightBound: boolean): ASTNode | undefined {
  if (includeRightBound === void 0) {
    includeRightBound = false;
  }
  if (contains(node, offset, includeRightBound)) {
    const children = node.children;
    if (Array.isArray(children)) {
      for (let i = 0; i < children.length && children[i].offset <= offset; i++) {
        const item = findNodeAtOffset(children[i], offset, includeRightBound);
        if (item) {
          return item;
        }
      }
    }
    return node;
  }
  return undefined;
}
