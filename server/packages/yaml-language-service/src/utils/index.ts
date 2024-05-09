/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Document, Node, Range, YAMLMap, YAMLSeq, isDocument, isScalar, visit } from "yaml";
import { YamlNode } from "../parser/astTypes";
import { CharCode } from "../parser/charCode";

export function getIndentation(lineContent: string, lineOffset: number): number {
  if (lineContent.length < lineOffset) {
    return 0;
  }

  for (let i = 0; i < lineOffset; i++) {
    const char = lineContent.charCodeAt(i);
    if (char !== CharCode.Space && char !== CharCode.Tab) {
      return i;
    }
  }

  // assuming that current position is indentation
  return lineOffset;
}

export function getParent(doc: Document, nodeToFind: YamlNode): YamlNode | undefined {
  let parentNode: Node | undefined = undefined;
  visit(doc, (_, node, path) => {
    if (node === nodeToFind || rangeMatches(node as HasRange, nodeToFind as HasRange)) {
      parentNode = path[path.length - 1] as Node;
      return visit.BREAK;
    }
  });

  if (isDocument(parentNode)) {
    return undefined;
  }

  return parentNode;
}

export function indexOf(seq: YAMLSeq, item: YamlNode): number | undefined {
  for (const [i, obj] of seq.items.entries()) {
    if (item === obj) {
      return i;
    }
  }
  return undefined;
}

export function isMapContainsEmptyPair(map: YAMLMap): boolean {
  if (map.items.length > 1) {
    return false;
  }

  const pair = map.items[0];
  return isScalar(pair.key) && isScalar(pair.value) && pair.key.value === "" && !pair.value.value;
}

export interface HasRange {
  range: Range;
}

export function rangeMatches(nodeA: HasRange, nodeB: HasRange): boolean {
  if (nodeA.range && nodeB.range && nodeA.range.length === nodeB.range.length) {
    return nodeA.range.every((value, index) => value === nodeB.range[index]);
  }
  return false;
}
