/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * This is a modified version of the original yamlCompletion logic from the yaml-language-server.
 * The original file can be found here: https://github.com/redhat-developer/yaml-language-server/blob/main/src/languageservice/services/yamlCompletion.ts#L1601
 *
 * The reason for this is that the original dependency is not compatible with the browser version of the language server.
 * In addition, there are some differences in the way we handle the AST and the schemas.
 */

import {
  CompletionItem as CompletionItemBase,
  CompletionItemKind,
  CompletionList,
  DocumentContext,
  InsertTextFormat,
  MarkupContent,
  MarkupKind,
  Position,
  Range,
  TextEdit,
  WorkflowInput,
  WorkflowOutput,
  WorkflowTestsDocument,
} from "@gxwf/server-common/src/languageTypes";
import { YamlNode } from "@gxwf/yaml-language-service/src/parser/astTypes";
import { YAMLSubDocument } from "@gxwf/yaml-language-service/src/parser/yamlDocument";
import { HasRange, indexOf, isMapContainsEmptyPair, rangeMatches } from "@gxwf/yaml-language-service/src/utils";
import { guessIndentation } from "@gxwf/yaml-language-service/src/utils/indentationGuesser";
import { TextBuffer } from "@gxwf/yaml-language-service/src/utils/textBuffer";
import { Node, Pair, YAMLMap, YAMLSeq, Range as YamlRange, isMap, isNode, isPair, isScalar, isSeq } from "yaml";
import { isDefined, isString } from "../../schema/adapter";
import { JSONSchema, JSONSchemaRef } from "../../schema/jsonSchema";
import { WorkflowTestsSchemaService } from "../../schema/service";

const doubleQuotesEscapeRegExp = /[\\]+"/g;
const parentCompletionKind = CompletionItemKind.Class;
const existingProposeItem = "__";

interface ParentCompletionItemOptions {
  schema: JSONSchema;
  indent?: string;
  insertTexts?: string[];
}

interface CompletionItem extends CompletionItemBase {
  parent?: ParentCompletionItemOptions;
}

interface CompletionsCollector {
  add(suggestion: CompletionItem, oneOfSchema?: boolean): void;
  error(message: string): void;
  log(message: string): void;
  getNumberOfProposals(): number;
  result: CompletionList;
  proposed: { [key: string]: CompletionItem };
}

interface InsertText {
  insertText: string;
  insertIndex: number;
}

export class YAMLCompletionHelper {
  private indentation: string = "  ";
  private arrayPrefixIndentation: string = "";
  private workflowInputs: WorkflowInput[] = [];
  private workflowOutputs: WorkflowOutput[] = [];

  constructor(protected schemaService: WorkflowTestsSchemaService) {}

  private get newTestSnippet(): string {
    return `- doc: \${1:TODO write test description}
${this.indentation}job:
${this.indentation}${this.indentation}$0
`;
  }

  private get newTestSnippetCompletion(): CompletionItem {
    const completionItem: CompletionItem = {
      label: "- doc:",
      labelDetails: { detail: "New Workflow Test" },
      documentation: {
        kind: MarkupKind.Markdown,
        value:
          "Create a new workflow test definition.\n\nYou can provide a `description` for the test and then press `Tab` to continue defining input jobs.",
      },
      kind: CompletionItemKind.Property,
      insertText: this.newTestSnippet,
      insertTextFormat: InsertTextFormat.Snippet,
    };
    return completionItem;
  }

  public async doComplete(documentContext: DocumentContext, position: Position): Promise<CompletionList> {
    const result = CompletionList.create([], false);

    const document = documentContext.textDocument;
    const textBuffer = new TextBuffer(document);

    const indent = guessIndentation(textBuffer, 2, true);
    this.indentation = indent.insertSpaces ? " ".repeat(indent.tabSize) : "\t";

    const offset = document.offsetAt(position);
    const text = document.getText();

    if (text.charAt(offset - 1) === ":") {
      return Promise.resolve(result);
    }

    let currentDoc = documentContext.internalDocument as YAMLSubDocument;
    if (currentDoc === null) {
      return Promise.resolve(result);
    }
    // as we modify AST for completion, we need to use copy of original document
    currentDoc = currentDoc.clone();
    let [node, foundByClosest] = currentDoc.getNodeFromPosition(offset, textBuffer, this.indentation.length);

    if (!node) {
      result.items.push(this.newTestSnippetCompletion);
      return Promise.resolve(result);
    }

    const currentWord = textBuffer.getCurrentWord(offset);
    let lineContent = textBuffer.getLineContent(position.line);
    const lineAfterPosition = lineContent.substring(position.character);
    const areOnlySpacesAfterPosition = /^[ ]+\n?$/.test(lineAfterPosition);

    // if the line is empty, or only contains a dash without indentation,
    // we suggest a new test snippet
    if (lineContent.match(/^(\n|-|- {1}|-\n)$/)) {
      result.items.push(this.newTestSnippetCompletion);
      return Promise.resolve(result);
    }

    // Gather all the workflow information needed to provide completions
    const testDocument = documentContext as WorkflowTestsDocument;
    this.workflowInputs = await testDocument.getWorkflowInputs();
    this.workflowOutputs = await testDocument.getWorkflowOutputs();

    let overwriteRange: Range | null = null;
    if (areOnlySpacesAfterPosition) {
      overwriteRange = Range.create(position, Position.create(position.line, lineContent.length));
      const isOnlyWhitespace = lineContent.trim().length === 0;
      const isOnlyDash = lineContent.match(/^\s*(-)\s*$/);
      if (node && isScalar(node) && !isOnlyWhitespace && !isOnlyDash) {
        const lineToPosition = lineContent.substring(0, position.character);
        const matches =
          // get indentation of unfinished property (between indent and cursor)
          lineToPosition.match(/^[\s-]*([^:]+)?$/) ||
          // OR get unfinished value (between colon and cursor)
          lineToPosition.match(/:[ \t]((?!:[ \t]).*)$/);

        if (matches?.[1]) {
          overwriteRange = Range.create(
            Position.create(position.line, position.character - matches[1].length),
            Position.create(position.line, lineContent.length)
          );
        }
      }
    } else if (node && isScalar(node) && node.value === "null") {
      const nodeStartPos = document.positionAt(node.range?.[0] ?? 0);
      nodeStartPos.character += 1;
      const nodeEndPos = document.positionAt(node.range?.[2] ?? 0);
      nodeEndPos.character += 1;
      overwriteRange = Range.create(nodeStartPos, nodeEndPos);
    } else if (node && isScalar(node) && node.value) {
      const start = document.positionAt(node.range?.[0] ?? 0);
      overwriteRange = Range.create(start, document.positionAt(node.range?.[1] ?? 0));
    } else if (node && isScalar(node) && node.value === null && currentWord === "-") {
      overwriteRange = Range.create(position, position);
      this.arrayPrefixIndentation = " ";
    } else {
      let overwriteStart = offset - currentWord.length;
      if (overwriteStart > 0 && text[overwriteStart - 1] === '"') {
        overwriteStart--;
      }
      overwriteRange = Range.create(document.positionAt(overwriteStart), position);
    }

    const proposed: { [key: string]: CompletionItem } = {};
    const collector: CompletionsCollector = {
      add: (completionItem: CompletionItem, oneOfSchema: boolean) => {
        const addSuggestionForParent = function (completionItem: CompletionItem): void {
          const existsInYaml = proposed[completionItem.label]?.label === existingProposeItem;
          //don't put to parent suggestion if already in yaml
          if (existsInYaml) {
            return;
          }
          const schema = completionItem.parent?.schema;
          const schemaType = schema?.title ?? "unknown schema type";
          const schemaDescription = schema?.description;

          let parentCompletion: CompletionItem | undefined = result.items.find(
            (item: CompletionItem) => item.parent?.schema === schema && item.kind === parentCompletionKind
          );

          if (!completionItem.insertText) {
            completionItem.insertText = completionItem.label;
          }

          if (!parentCompletion) {
            // create a new parent
            parentCompletion = {
              ...completionItem,
              documentation: schemaDescription,
              sortText: "_" + schemaType, // this parent completion goes first,
              kind: parentCompletionKind,
            };
            parentCompletion.label = parentCompletion.label || completionItem.label;
            result.items.push(parentCompletion);
          } else if (parentCompletion.parent?.insertTexts?.includes(completionItem.insertText)) {
            // already exists in the parent
            return;
          } else {
            // add to the existing parent
            parentCompletion.parent?.insertTexts?.push(completionItem.insertText);
          }
        };

        const isForParentCompletion = !!completionItem.parent;
        let label = completionItem.label;
        if (!label) {
          // we receive not valid CompletionItem as `label` is mandatory field, so just ignore it
          console.warn(`Ignoring CompletionItem without label: ${JSON.stringify(completionItem)}`);
          return;
        }
        if (!isString(label)) {
          label = String(label);
        }

        label = label.replace(/[\n]/g, "↵");
        if (label.length > 60) {
          const shortendedLabel = label.substr(0, 57).trim() + "...";
          if (!proposed[shortendedLabel]) {
            label = shortendedLabel;
          }
        }

        // trim $1 from end of completion
        if (completionItem.insertText) {
          if (completionItem.insertText.endsWith("$1") && !isForParentCompletion) {
            completionItem.insertText = completionItem.insertText.substr(0, completionItem.insertText.length - 2);
          }
          if (overwriteRange && overwriteRange.start.line === overwriteRange.end.line) {
            completionItem.textEdit = TextEdit.replace(overwriteRange, completionItem.insertText);
          }
        }

        completionItem.label = label;

        if (isForParentCompletion) {
          addSuggestionForParent(completionItem);
          return;
        }

        if (this.arrayPrefixIndentation) {
          this.updateCompletionText(completionItem, this.arrayPrefixIndentation + completionItem.insertText);
        }

        const existing = proposed[label];
        const isInsertTextDifferent =
          existing?.label !== existingProposeItem && existing?.insertText !== completionItem.insertText;
        if (!existing) {
          proposed[label] = completionItem;
          result.items.push(completionItem);
        } else if (existing.insertText && completionItem.insertText && isInsertTextDifferent) {
          // try to merge simple insert values
          const mergedText = this.mergeSimpleInsertTexts(
            label,
            existing.insertText,
            completionItem.insertText,
            oneOfSchema
          );
          if (mergedText) {
            this.updateCompletionText(existing, mergedText);
          } else {
            // add to result when it wasn't able to merge (even if the item is already there but with a different value)
            proposed[label] = completionItem;
            result.items.push(completionItem);
          }
        }
        if (existing && !existing.documentation && completionItem.documentation) {
          existing.documentation = completionItem.documentation;
        }
      },
      error: (message: string) => {
        console.error(message);
      },
      log: (message: string) => {
        console.log(message);
      },
      getNumberOfProposals: () => {
        return result.items.length;
      },
      result,
      proposed,
    };

    if (lineContent.endsWith("\n")) {
      lineContent = lineContent.substring(0, lineContent.length - 1);
    }

    try {
      const schema = this.schemaService.schema;

      if (!schema || schema.errors.length) {
        return result;
      }

      let currentProperty: YamlNode | null = null;

      if (!node) {
        if (!currentDoc.internalDocument.contents || isScalar(currentDoc.internalDocument.contents)) {
          const map = currentDoc.internalDocument.createNode({});
          map.range = [offset, offset + 1, offset + 1];
          currentDoc.internalDocument.contents = map;
          currentDoc.updateFromInternalDocument();
          node = map;
        } else {
          node = currentDoc.findClosestNode(offset, textBuffer);
          foundByClosest = true;
        }
      }

      const originalNode = node!;
      if (node) {
        if (lineContent.length === 0) {
          node = currentDoc.internalDocument.contents as Node;
        } else {
          const parent = currentDoc.getParent(node);
          if (parent) {
            if (isScalar(node)) {
              if (node.value) {
                if (isPair(parent)) {
                  if (parent.value === node) {
                    if (lineContent.trim().length > 0 && lineContent.indexOf(":") < 0) {
                      const map = this.createTempObjNode(currentWord, node, currentDoc);
                      const parentParent = currentDoc.getParent(parent);
                      if (isSeq(currentDoc.internalDocument.contents)) {
                        const index = indexOf(currentDoc.internalDocument.contents, parent);
                        if (typeof index === "number") {
                          currentDoc.internalDocument.set(index, map);
                          currentDoc.updateFromInternalDocument();
                        }
                      } else if (parentParent && (isMap(parentParent) || isSeq(parentParent))) {
                        parentParent.set(parent.key, map);
                        currentDoc.updateFromInternalDocument();
                      } else {
                        currentDoc.internalDocument.set(parent.key, map);
                        currentDoc.updateFromInternalDocument();
                      }

                      currentProperty = (map as YAMLMap).items[0];
                      node = map;
                    } else if (lineContent.trim().length === 0) {
                      const parentParent = currentDoc.getParent(parent);
                      if (parentParent) {
                        node = parentParent;
                      }
                    }
                  } else if (parent.key === node) {
                    const parentParent = currentDoc.getParent(parent);
                    currentProperty = parent;
                    if (parentParent) {
                      node = parentParent;
                    }
                  }
                } else if (isSeq(parent)) {
                  if (lineContent.trim().length > 0) {
                    const map = this.createTempObjNode(currentWord, node, currentDoc);
                    parent.delete(node);
                    parent.add(map);
                    currentDoc.updateFromInternalDocument();
                    node = map;
                  } else {
                    node = parent;
                  }
                }
              } else if (node.value === null) {
                if (isPair(parent)) {
                  if (parent.key === node) {
                    node = parent;
                  } else {
                    if (isNode(parent.key) && parent.key.range) {
                      const parentParent = currentDoc.getParent(parent);
                      if (
                        foundByClosest &&
                        parentParent &&
                        isMap(parentParent) &&
                        isMapContainsEmptyPair(parentParent)
                      ) {
                        node = parentParent;
                      } else {
                        const parentPosition = document.positionAt(parent.key.range[0]);
                        //if cursor has bigger indentation that parent key, then we need to complete new empty object
                        if (position.character > parentPosition.character && position.line !== parentPosition.line) {
                          const map = this.createTempObjNode(currentWord, node, currentDoc);

                          if (parentParent && (isMap(parentParent) || isSeq(parentParent))) {
                            parentParent.set(parent.key, map);
                            currentDoc.updateFromInternalDocument();
                          } else {
                            currentDoc.internalDocument.set(parent.key, map);
                            currentDoc.updateFromInternalDocument();
                          }
                          currentProperty = (map as YAMLMap).items[0];
                          node = map;
                        } else if (parentPosition.character === position.character) {
                          if (parentParent) {
                            node = parentParent;
                          }
                        }
                      }
                    }
                  }
                } else if (isSeq(parent)) {
                  if (lineContent.charAt(position.character - 1) !== "-") {
                    const map = this.createTempObjNode(currentWord, node, currentDoc);
                    parent.delete(node);
                    parent.add(map);
                    currentDoc.updateFromInternalDocument();
                    node = map;
                  } else if (lineContent.charAt(position.character - 1) === "-") {
                    const map = this.createTempObjNode("", node, currentDoc);
                    parent.delete(node);
                    parent.add(map);
                    currentDoc.updateFromInternalDocument();
                    node = map;
                  } else {
                    node = parent;
                  }
                }
              }
            } else if (isMap(node)) {
              if (!foundByClosest && lineContent.trim().length === 0 && isSeq(parent)) {
                const nextLine = textBuffer.getLineContent(position.line + 1);
                if (textBuffer.getLineCount() === position.line + 1 || nextLine.trim().length === 0) {
                  node = parent;
                }
              }
            }
          } else if (isScalar(node)) {
            const map = this.createTempObjNode(currentWord, node, currentDoc);
            currentDoc.internalDocument.contents = map;
            currentDoc.updateFromInternalDocument();
            currentProperty = map.items[0];
            node = map;
          } else if (isMap(node)) {
            for (const pair of node.items) {
              if (isNode(pair.value) && pair.value.range && pair.value.range[0] === offset + 1) {
                node = pair.value;
              }
            }
          } else if (isSeq(node)) {
            if (lineContent.charAt(position.character - 1) !== "-") {
              /**
               * It the indentation of the current line matches the indentation of the item in the sequence node
               * then we are at the same level as the item in the sequence so it should be a sibling of the item
               */
              let range: YamlRange | undefined = undefined;
              const lastItem = node.items[node.items.length - 1] as YAMLMap;
              if (lastItem) {
                node = lastItem;
                range = lastItem.range ?? undefined;
              }

              const map = this.createTempObjNode(currentWord, node, currentDoc, range);
              map.items = [];
              currentDoc.updateFromInternalDocument();
              for (const pair of node.items) {
                map.items.push(pair as Pair);
              }
              node = map;
            }
          }
        }
      }

      // completion for object keys
      if (node && isMap(node)) {
        // don't suggest properties that are already present
        const properties = node.items;
        for (const p of properties) {
          if (!currentProperty || currentProperty !== p) {
            if (isScalar(p.key)) {
              proposed[p.key.value + ""] = CompletionItemBase.create(existingProposeItem);
            }
          }
        }

        await this.addPropertyCompletions(
          documentContext,
          currentDoc,
          node,
          originalNode,
          "",
          collector,
          textBuffer,
          overwriteRange
        );

        if (!schema && currentWord.length > 0 && text.charAt(offset - currentWord.length - 1) !== '"') {
          collector.add({
            kind: CompletionItemKind.Property,
            label: currentWord,
            insertText: this.getInsertTextForProperty(currentWord, null, ""),
            insertTextFormat: InsertTextFormat.Snippet,
          });
        }
      }

      // proposals for values
      const types: { [type: string]: boolean } = {};
      this.getValueCompletions(documentContext, currentDoc, offset, collector, types, node);
    } catch (err) {
      console.error(err);
    }

    this.finalizeParentCompletion(result);

    result.items = this.mergeCompletionItems(result.items);

    // console.debug("COMPLETION RESULT:", result);
    return result;
  }

  /**
   * Returns a new list of completion items with unique labels.
   * If the label is the same, the information is merged.
   * @param items The list of completion items to merge
   * @returns A list of completion items with unique labels
   */
  mergeCompletionItems(items: CompletionItem[]): CompletionItem[] {
    const uniqueItems: CompletionItem[] = [];
    const existingItems: { [key: string]: CompletionItem } = {};

    items.forEach((item) => {
      const key = `${item.label}-${item.insertText}`;
      if (!existingItems[key]) {
        existingItems[key] = item;
        uniqueItems.push(item);
      } else {
        const existingItem = existingItems[key];
        if (item.documentation && existingItem.documentation) {
          existingItem.documentation = this.mergeMarkupContent(existingItem.documentation, item.documentation);
        }
      }
    });

    return uniqueItems;
  }

  /**
   * Merges two MarkupContent objects into one.
   * @param existing The existing MarkupContent object
   * @param newContent The new MarkupContent object
   * @returns The merged MarkupContent object
   */
  mergeMarkupContent(existing?: string | MarkupContent, newContent?: string | MarkupContent): MarkupContent {
    const existingContent = this.getMarkupContent(existing);
    const newContentContent = this.getMarkupContent(newContent);

    if (!existingContent) {
      return newContentContent;
    }

    if (!newContentContent) {
      return existingContent;
    }

    return {
      kind: MarkupKind.Markdown,
      value: `${existingContent.value}\n\n${newContentContent.value}`,
    };
  }

  /**
   * Returns a MarkupContent object from a string or MarkupContent object.
   * @param content The content to convert
   * @returns The MarkupContent object
   */
  getMarkupContent(content?: string | MarkupContent): MarkupContent {
    if (!content) {
      content = "";
    }
    if (typeof content === "string") {
      return {
        kind: MarkupKind.Markdown,
        value: content,
      };
    }
    return content;
  }

  updateCompletionText(completionItem: CompletionItem, text: string): void {
    completionItem.insertText = text;
    if (completionItem.textEdit) {
      completionItem.textEdit.newText = text;
    }
  }

  mergeSimpleInsertTexts(
    label: string,
    existingText: string,
    addingText: string,
    oneOfSchema: boolean
  ): string | undefined {
    const containsNewLineAfterColon = (value: string): boolean => {
      return value.includes("\n");
    };
    const startWithNewLine = (value: string): boolean => {
      return value.startsWith("\n");
    };
    const isNullObject = (value: string): boolean => {
      const index = value.indexOf("\n");
      return index > 0 && value.substring(index, value.length).trim().length === 0;
    };
    if (containsNewLineAfterColon(existingText) || containsNewLineAfterColon(addingText)) {
      //if the exisiting object null one then replace with the non-null object
      if (oneOfSchema && isNullObject(existingText) && !isNullObject(addingText) && !startWithNewLine(addingText)) {
        return addingText;
      }
      return undefined;
    }
    const existingValues = this.getValuesFromInsertText(existingText);
    const addingValues = this.getValuesFromInsertText(addingText);

    const newValues = Array.prototype.concat(existingValues, addingValues);
    if (!newValues.length) {
      return undefined;
    } else if (newValues.length === 1) {
      return `${label}: \${1:${newValues[0]}}`;
    } else {
      return `${label}: \${1|${newValues.join(",")}|}`;
    }
  }

  getValuesFromInsertText(insertText: string): string[] {
    const value = insertText.substring(insertText.indexOf(":") + 1).trim();
    if (!value) {
      return [];
    }
    const valueMath = value.match(/^\${1[|:]([^|]*)+\|?}$/); // ${1|one,two,three|}  or  ${1:one}
    if (valueMath) {
      return valueMath[1].split(",");
    }
    return [value];
  }

  private getInsertTextForProperty(
    key: string,
    propertySchema: JSONSchema | null,
    separatorAfter: string,
    indent = this.indentation
  ): string {
    const propertyText = this.getInsertTextForValue(key, "", "string");
    const resultText = propertyText + ":";

    let value: string = "";
    let nValueProposals = 0;
    if (propertySchema) {
      let type = Array.isArray(propertySchema.type) ? propertySchema.type[0] : propertySchema.type;
      if (!type) {
        if (propertySchema.properties) {
          type = "object";
        } else if (propertySchema.items) {
          type = "array";
        } else if (propertySchema.anyOf) {
          type = "anyOf";
        }
      }

      if (propertySchema.enum) {
        if (!value && propertySchema.enum.length === 1) {
          value = " " + this.getInsertTextForGuessedValue(propertySchema.enum[0], "", type);
        }
        nValueProposals += propertySchema.enum.length;
      }

      if (propertySchema.const) {
        if (!value) {
          value = this.getInsertTextForGuessedValue(propertySchema.const, "", type);
          value = evaluateTab1Symbol(value); // prevent const being selected after snippet insert
          value = " " + value;
        }
        nValueProposals++;
      }

      if (isDefined(propertySchema.default)) {
        if (!value) {
          value = " " + this.getInsertTextForGuessedValue(propertySchema.default, "", type);
        }
        nValueProposals++;
      }

      if (propertySchema.properties) {
        return `${resultText}\n${this.getInsertTextForObject(propertySchema, separatorAfter, indent).insertText}`;
      } else if (propertySchema.items) {
        return `${resultText}\n${indent}- ${
          this.getInsertTextForArray(propertySchema.items, separatorAfter, 1, indent).insertText
        }`;
      }
      if (nValueProposals === 0) {
        switch (type) {
          case "boolean":
            value = " $1";
            break;
          case "string":
            value = " $1";
            break;
          case "object":
            value = `\n${indent}`;
            break;
          case "array":
            value = `\n${indent}- `;
            break;
          case "number":
          case "integer":
            value = " ${1:0}";
            break;
          case "null":
            value = " ${1:null}";
            break;
          case "anyOf":
            value = " $1";
            break;
          default:
            return resultText;
        }
      }
    }
    if (!value || nValueProposals > 1) {
      value = " $1";
    }
    return resultText + value + separatorAfter;
  }

  private getInsertTextForObject(
    schema: JSONSchema,
    separatorAfter: string,
    indent = this.indentation,
    insertIndex = 1
  ): InsertText {
    let insertText = "";
    if (!schema.properties) {
      insertText = `${indent}$${insertIndex++}\n`;
      return { insertText, insertIndex };
    }

    const properties = schema.properties;

    if (!properties) {
      return { insertText, insertIndex };
    }

    Object.keys(properties).forEach((key: string) => {
      const propertySchema = properties[key];
      let type = Array.isArray(propertySchema?.type) ? propertySchema.type[0] : propertySchema?.type;
      if (!type) {
        if (propertySchema.anyOf) {
          type = "anyOf";
        }
        if (propertySchema.properties) {
          type = "object";
        }
        if (propertySchema.items) {
          type = "array";
        }
      }
      if (schema.required && schema.required.indexOf(key) > -1) {
        switch (type) {
          case "boolean":
          case "string":
          case "number":
          case "integer":
          case "anyOf": {
            let value = propertySchema.default || propertySchema.const;
            if (value) {
              if (type === "string") {
                value = convertToStringValue(value);
              }
              insertText += `${indent}${key}: \${${insertIndex++}:${value}}\n`;
            } else {
              insertText += `${indent}${key}: $${insertIndex++}\n`;
            }
            break;
          }
          case "array":
            {
              const arrayInsertResult = this.getInsertTextForArray(
                propertySchema.items,
                separatorAfter,
                insertIndex++,
                indent
              );
              const arrayInsertLines = arrayInsertResult.insertText.split("\n");
              let arrayTemplate = arrayInsertResult.insertText;
              if (arrayInsertLines.length > 1) {
                for (let index = 1; index < arrayInsertLines.length; index++) {
                  const element = arrayInsertLines[index];
                  arrayInsertLines[index] = `  ${element}`;
                }
                arrayTemplate = arrayInsertLines.join("\n");
              }
              insertIndex = arrayInsertResult.insertIndex;
              insertText += `${indent}${key}:\n${indent}${this.indentation}- ${arrayTemplate}\n`;
            }
            break;
          case "object":
            {
              const objectInsertResult = this.getInsertTextForObject(
                propertySchema,
                separatorAfter,
                `${indent}${this.indentation}`,
                insertIndex++
              );
              insertIndex = objectInsertResult.insertIndex;
              insertText += `${indent}${key}:\n${objectInsertResult.insertText}\n`;
            }
            break;
        }
      } else if (propertySchema.default !== undefined) {
        switch (type) {
          case "boolean":
          case "number":
          case "integer":
            insertText += `${indent}${
              //added quote if key is null
              key === "null" ? this.getInsertTextForValue(key, "", "string") : key
            }: \${${insertIndex++}:${propertySchema.default}}\n`;
            break;
          case "string":
            insertText += `${indent}${key}: \${${insertIndex++}:${convertToStringValue(propertySchema.default)}}\n`;
            break;
          case "array":
          case "object":
            // TODO: support default value for array object
            break;
        }
      }
    });
    if (insertText.trim().length === 0) {
      insertText = `${indent}$${insertIndex++}\n`;
    }
    insertText = insertText.trimRight() + separatorAfter;
    return { insertText, insertIndex };
  }

  private createTempObjNode(currentWord: string, node: Node, currentDoc: YAMLSubDocument, range?: YamlRange): YAMLMap {
    range = range || node.range || undefined;
    const obj: { [key: string]: unknown } = {}; // Add index signature to allow indexing with a string
    obj[currentWord] = null;
    const map: YAMLMap = currentDoc.internalDocument.createNode(obj) as YAMLMap;
    //**********************************
    //TODO: the range here is not correct, it should be the range of the current line
    //**********************************
    map.range = range;
    (map.items[0].key as Node).range = range;
    (map.items[0].value as Node).range = range;
    return map;
  }

  private getInsertTextForArray(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any,
    separatorAfter: string,
    insertIndex = 1,
    indent = this.indentation
  ): InsertText {
    let insertText = "";
    if (!schema) {
      insertText = `$${insertIndex++}`;
      return { insertText, insertIndex };
    }
    let type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    if (!type) {
      if (schema.properties) {
        type = "object";
      }
      if (schema.items) {
        type = "array";
      }
    }
    switch (schema.type) {
      case "boolean":
        insertText = `\${${insertIndex++}:false}`;
        break;
      case "number":
      case "integer":
        insertText = `\${${insertIndex++}:0}`;
        break;
      case "string":
        insertText = `\${${insertIndex++}:""}`;
        break;
      case "object":
        {
          const objectInsertResult = this.getInsertTextForObject(schema, separatorAfter, `${indent}  `, insertIndex++);
          insertText = objectInsertResult.insertText.trimLeft();
          insertIndex = objectInsertResult.insertIndex;
        }
        break;
    }
    return { insertText, insertIndex };
  }

  private finalizeParentCompletion(result: CompletionList): void {
    const reindexText = (insertTexts: string[]): string[] => {
      //modify added props to have unique $x
      let max$index = 0;
      return insertTexts.map((text) => {
        const match = text.match(/\$([0-9]+)|\${[0-9]+:/g);
        if (!match) {
          return text;
        }
        const max$indexLocal = match
          .map((m) => +m.replace(/\${([0-9]+)[:|]/g, "$1").replace("$", "")) // get numbers form $1 or ${1:...}
          .reduce((p, n) => (n > p ? n : p), 0); // find the max one
        const reindexedStr = text
          .replace(/\$([0-9]+)/g, (_s, args) => "$" + (+args + max$index)) // increment each by max$index
          .replace(/\${([0-9]+)[:|]/g, (_s, args) => "${" + (+args + max$index) + ":"); // increment each by max$index
        max$index += max$indexLocal;
        return reindexedStr;
      });
    };

    result.items.forEach((completionItem) => {
      if (isParentCompletionItem(completionItem) && completionItem.parent) {
        const indent = completionItem.parent.indent || "";

        let insertText = completionItem.insertText || "";
        if (completionItem.parent.insertTexts) {
          const reindexedTexts = reindexText(completionItem.parent.insertTexts);

          // add indent to each object property and join completion item texts
          insertText = reindexedTexts.join(`\n${indent}`);

          // trim $1 from end of completion
          if (insertText.endsWith("$1")) {
            insertText = insertText.substring(0, insertText.length - 2);
          }

          completionItem.insertText = this.arrayPrefixIndentation + insertText;
        }

        if (completionItem.textEdit) {
          completionItem.textEdit.newText = insertText;
        }
        // remove $x or use {$x:value} in documentation
        const mdText = insertText.replace(/\${[0-9]+[:|](.*)}/g, (_s, arg) => arg).replace(/\$([0-9]+)/g, "");

        const originalDocumentation = completionItem.documentation
          ? [completionItem.documentation, "", "----", ""]
          : [];
        completionItem.documentation = {
          kind: MarkupKind.Markdown,
          value: [...originalDocumentation, "```yaml", indent + mdText, "```"].join("\n"),
        };
        delete completionItem.parent;
      }
    });
  }

  private async addPropertyCompletions(
    documentContext: DocumentContext,
    doc: YAMLSubDocument,
    node: YAMLMap,
    originalNode: YamlNode,
    separatorAfter: string,
    collector: CompletionsCollector,
    textBuffer: TextBuffer,
    overwriteRange: Range
  ): Promise<void> {
    const didCallFromAutoComplete = true;
    const nodeOffset = textBuffer.getOffsetAt(overwriteRange.start);
    let matchingSchemas = this.schemaService.getMatchingSchemas(documentContext, nodeOffset, didCallFromAutoComplete);
    const existingKey = textBuffer.getText(overwriteRange);
    const lineContent = textBuffer.getLineContent(overwriteRange.start.line);
    const hasOnlyWhitespace = lineContent.trim().length === 0;
    const hasColon = lineContent.indexOf(":") !== -1;
    // const isInArray = lineContent.trimLeft().indexOf("-") === 0;
    const nodeParent = doc.getParent(node);
    const matchOriginal = matchingSchemas.find(function (it) {
      return it.node.internalNode === originalNode && it.schema.properties;
    });

    // if the parent is the `job` key, then we need to add the workflow inputs
    if (nodeParent && isPair(nodeParent) && isScalar(nodeParent.key) && nodeParent.key.value === "job") {
      this.workflowInputs.forEach((input) => {
        collector.add({
          kind: CompletionItemKind.Property,
          label: input.name,
          insertText: `${this.quoteIfColon(input.name)}:`,
          insertTextFormat: InsertTextFormat.Snippet,
          documentation: this.fromMarkup(input.doc),
        });
      });
      return;
    }

    // if the parent is the `outputs` key, then we need to add the workflow outputs
    if (nodeParent && isPair(nodeParent) && isScalar(nodeParent.key) && nodeParent.key.value === "outputs") {
      this.workflowOutputs.forEach((output) => {
        collector.add({
          kind: CompletionItemKind.Property,
          label: output.name,
          insertText: `${this.quoteIfColon(output.name)}:`,
          insertTextFormat: InsertTextFormat.Snippet,
        });
      });
      return;
    }

    //If the parent is a workflow input, then we need to add the properties from the document context
    if (nodeParent && isPair(nodeParent) && isScalar(nodeParent.key)) {
      const nodeParentKey = nodeParent.key.value;
      const matchingWorkflowInput = this.workflowInputs.find((input) => input.name === nodeParentKey);
      if (matchingWorkflowInput) {
        const type = matchingWorkflowInput.type;
        const DATA_INPUT_TYPE_OPTIONS = ["PathFile", "LocationFile", "CompositeDataFile"];
        switch (type) {
          case "data":
          case "File":
            matchingSchemas = matchingSchemas.filter(
              (schema) => schema.schema.title && DATA_INPUT_TYPE_OPTIONS.includes(schema.schema.title)
            );
            if (node.items.length === 1 && isScalar(node.items[0].key) && node.items[0].key.value === "") {
              for (const schema of matchingSchemas) {
                const firstRequired = schema.schema.required?.find((key) => key !== "class") ?? "";
                collector.add(
                  {
                    kind: CompletionItemKind.Property,
                    label: `class ${schema.schema.title}`,
                    insertText: `class: File\n${firstRequired}: \${1:${firstRequired}}`,
                    insertTextFormat: InsertTextFormat.Snippet,
                    documentation: this.fromMarkup(
                      `The class of the input. This type of input requires the \`${firstRequired}\` attribute.`
                    ),
                    sortText: `${DATA_INPUT_TYPE_OPTIONS.indexOf(schema.schema.title!)}`,
                  },
                  false
                );
              }
              return;
            }
            break;
          case "collection":
            matchingSchemas = matchingSchemas.filter((schema) => schema.schema.title === "Collection");
            break;
        }
      }
    }

    const oneOfSchema = matchingSchemas
      .filter((schema) => schema.schema.oneOf)
      .map((oneOfSchema) => oneOfSchema.schema.oneOf)[0];
    let didOneOfSchemaMatches = false;
    if (oneOfSchema?.length ?? 0 < matchingSchemas.length) {
      oneOfSchema?.forEach((property: JSONSchema, index: number) => {
        if (
          !matchingSchemas[index]?.schema.oneOf &&
          matchingSchemas[index]?.schema.properties === property.properties
        ) {
          didOneOfSchemaMatches = true;
        }
      });
    }

    for (const schema of matchingSchemas) {
      const internalNode = schema.node.internalNode as HasRange;
      if (
        (rangeMatches(internalNode, node as HasRange) && !matchOriginal) ||
        (internalNode === originalNode && !hasColon) ||
        (schema.node.parent?.internalNode === originalNode && !hasColon)
      ) {
        const schemaProperties = schema.schema.properties;
        if (schemaProperties) {
          const maxProperties = schema.schema.maxProperties;
          if (
            maxProperties === undefined ||
            node.items === undefined ||
            node.items.length < maxProperties ||
            (node.items.length === maxProperties && !hasOnlyWhitespace)
          ) {
            for (const key in schemaProperties) {
              if (Object.prototype.hasOwnProperty.call(schemaProperties, key)) {
                const propertySchema = schemaProperties[key];

                if (
                  typeof propertySchema === "object" &&
                  !propertySchema.deprecationMessage &&
                  !propertySchema["doNotSuggest"]
                ) {
                  let identCompensation = "";
                  if (node.range && nodeParent && isSeq(nodeParent) && node.items.length <= 1 && !hasOnlyWhitespace) {
                    // because there is a slash '-' to prevent the properties generated to have the correct
                    // indent
                    const sourceText = textBuffer.getText();
                    const indexOfSlash = sourceText.lastIndexOf("-", node.range[0] - 1);
                    if (indexOfSlash >= 0) {
                      // add one space to compensate the '-'
                      const overwriteChars = overwriteRange.end.character - overwriteRange.start.character;
                      identCompensation = " " + sourceText.slice(indexOfSlash + 1, node.range[1] - overwriteChars);
                    }
                  }
                  identCompensation += this.arrayPrefixIndentation;

                  // if check that current node has last pair with "null" value and key witch match key from schema,
                  // and if schema has array definition it add completion item for array item creation
                  let pair: Pair | undefined;
                  if (
                    propertySchema.type === "array" &&
                    (pair = node.items.find(
                      (it) =>
                        isScalar(it.key) &&
                        it.key.range &&
                        it.key.value === key &&
                        isScalar(it.value) &&
                        !it.value.value &&
                        textBuffer.getPosition(it.key.range[2]).line === overwriteRange.end.line - 1
                    )) &&
                    pair
                  ) {
                    if (Array.isArray(propertySchema.items)) {
                      this.addSchemaValueCompletions(
                        propertySchema.items[0],
                        separatorAfter,
                        collector,
                        {},
                        "property"
                      );
                    } else if (typeof propertySchema.items === "object" && propertySchema.items.type === "object") {
                      this.addArrayItemValueCompletion(propertySchema.items, separatorAfter, collector);
                    }
                  }

                  let insertText = key;
                  if (!key.startsWith(existingKey) || !hasColon) {
                    insertText = this.getInsertTextForProperty(
                      key,
                      propertySchema,
                      separatorAfter,
                      identCompensation + this.indentation
                    );
                  }
                  const isNodeNull =
                    (isScalar(originalNode) && originalNode.value === null) ||
                    (isMap(originalNode) && originalNode.items.length === 0);
                  const existsParentCompletion = schema.schema.required?.length ?? 0 > 0;
                  if (!isNodeNull || !existsParentCompletion) {
                    collector.add(
                      {
                        kind: CompletionItemKind.Property,
                        label: key,
                        insertText,
                        insertTextFormat: InsertTextFormat.Snippet,
                        documentation: propertySchema.description || "",
                      },
                      didOneOfSchemaMatches
                    );
                  }
                  // if the prop is required add it also to parent suggestion
                  if (schema.schema.required?.includes(key)) {
                    collector.add({
                      label: key,
                      insertText: this.getInsertTextForProperty(
                        key,
                        propertySchema,
                        separatorAfter,
                        identCompensation + this.indentation
                      ),
                      insertTextFormat: InsertTextFormat.Snippet,
                      documentation: propertySchema.description || "",
                      parent: {
                        schema: schema.schema,
                        indent: identCompensation,
                      },
                    });
                  }
                }
              }
            }
          }
        }
        // Error fix
        // If this is a array of string/boolean/number
        //  test:
        //    - item1
        // it will treated as a property key since `:` has been appended
        if (nodeParent && isSeq(nodeParent) && isPrimitiveType(schema.schema)) {
          this.addSchemaValueCompletions(
            schema.schema,
            separatorAfter,
            collector,
            {},
            "property",
            Array.isArray(nodeParent.items)
          );
        }
      }
    }
  }

  private getValueCompletions(
    documentContext: DocumentContext,
    doc: YAMLSubDocument,
    offset: number,
    collector: CompletionsCollector,
    types: { [type: string]: boolean },
    node?: YamlNode
  ): void {
    const schema = this.schemaService.schema;
    let parentKey: string | null = null;

    if (node && isScalar(node)) {
      node = doc.getParent(node);
    }

    if (!node) {
      this.addSchemaValueCompletions(schema.schema, "", collector, types, "value");
      return;
    }

    if (isPair(node)) {
      const valueNode: Node = node.value as Node;
      if (valueNode && valueNode.range && offset > valueNode.range[0] + valueNode.range[2]) {
        return; // we are past the value node
      }
      parentKey = isScalar(node.key) ? node.key.value + "" : null;
      node = doc.getParent(node);
    }

    if (node && (parentKey !== null || isSeq(node))) {
      const separatorAfter = "";
      const didCallFromAutoComplete = true;
      // Check if the parent is a workflow input
      const matchingInput = this.workflowInputs.find((input) => input.name === parentKey);
      if (matchingInput) {
        const type = matchingInput.type;
        let typeSchema: JSONSchema = { type: "string" };
        switch (type) {
          case "boolean":
            this.addBooleanValueCompletion(true, separatorAfter, collector);
            this.addBooleanValueCompletion(false, separatorAfter, collector);
            return;
          case "null":
            this.addNullValueCompletion(separatorAfter, collector);
            return;
          case "double":
          case "float":
          case "long":
          case "int":
          case "integer":
            typeSchema = { type: "number" };
            break;
        }
        this.addSchemaValueCompletions(typeSchema, separatorAfter, collector, types, "value");
        return;
      }
      const matchingSchemas = this.schemaService.getMatchingSchemas(documentContext, offset, didCallFromAutoComplete);
      for (const s of matchingSchemas) {
        const internalNode = s.node.internalNode as HasRange;
        if (rangeMatches(internalNode, node as HasRange) && s.schema) {
          if (s.schema.items) {
            if (isSeq(node) && node.items) {
              if (Array.isArray(s.schema.items)) {
                const index = this.findItemAtOffset(node, offset);
                if (index < s.schema.items.length) {
                  this.addSchemaValueCompletions(s.schema.items[index], separatorAfter, collector, types, "value");
                }
              } else if (
                typeof s.schema.items === "object" &&
                (s.schema.items.type === "object" || isAnyOfAllOfOneOfType(s.schema.items))
              ) {
                this.addSchemaValueCompletions(s.schema.items, separatorAfter, collector, types, "value", true);
              } else {
                this.addSchemaValueCompletions(s.schema.items, separatorAfter, collector, types, "value");
              }
            }
          }
          if (s.schema.properties && parentKey !== null) {
            const propertySchema = s.schema.properties[parentKey];
            if (propertySchema) {
              this.addSchemaValueCompletions(propertySchema, separatorAfter, collector, types, "value");
            }
          } else if (s.schema.additionalProperties) {
            this.addSchemaValueCompletions(s.schema.additionalProperties, separatorAfter, collector, types, "value");
          }
        }
      }

      if (types["boolean"]) {
        this.addBooleanValueCompletion(true, separatorAfter, collector);
        this.addBooleanValueCompletion(false, separatorAfter, collector);
      }
      if (types["null"]) {
        this.addNullValueCompletion(separatorAfter, collector);
      }
    }
  }

  private addArrayItemValueCompletion(
    schema: JSONSchema,
    separatorAfter: string,
    collector: CompletionsCollector,
    index?: number
  ): void {
    const schemaType = getSchemaTypeName(schema);
    const insertText = `- ${this.getInsertTextForObject(schema, separatorAfter).insertText.trimStart()}`;
    //append insertText to documentation
    const schemaTypeTitle = schemaType ? " type `" + schemaType + "`" : "";
    const schemaDescription = schema.description ? " (" + schema.description + ")" : "";
    const documentation = this.getDocumentationWithMarkdownText(
      `Create an item of an array${schemaTypeTitle}${schemaDescription}`,
      insertText
    );
    collector.add({
      kind: this.getSuggestionKind(schema.type),
      label: "- (array item) " + (schemaType || index),
      documentation: documentation,
      insertText: insertText,
      insertTextFormat: InsertTextFormat.Snippet,
    });
  }

  private getDocumentationWithMarkdownText(documentation: string, insertText: string): string | MarkupContent {
    let res: string | MarkupContent = documentation;
    if (this.doesSupportMarkdown()) {
      insertText = insertText
        .replace(/\${[0-9]+[:|](.*)}/g, (_s, arg) => {
          return arg;
        })
        .replace(/\$([0-9]+)/g, "");
      res = this.fromMarkup(`${documentation}\n \`\`\`\n${insertText}\n\`\`\``) as MarkupContent;
    }
    return res;
  }

  private fromMarkup(markupString: string): MarkupContent | undefined {
    if (markupString && this.doesSupportMarkdown()) {
      return {
        kind: MarkupKind.Markdown,
        value: markupString,
      };
    }
    return undefined;
  }

  private quoteIfColon(value: string): string {
    return value.includes(":") ? `'${value}'` : `${value}`;
  }

  private doesSupportMarkdown(): boolean {
    // Forcing markdown for now
    return true;
  }

  private getInsertTextForPlainText(text: string): string {
    return text.replace(/[\\$}]/g, "\\$&"); // escape $, \ and }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getInsertTextForValue(value: any, separatorAfter: string, type?: string | string[]): string {
    if (value === null) {
      return "null"; // replace type null with string 'null'
    }
    switch (typeof value) {
      case "object": {
        const indent = this.indentation;
        return this.getInsertTemplateForValue(value, indent, { index: 1 }, separatorAfter);
      }
      case "number":
      case "boolean":
        return this.getInsertTextForPlainText(value + separatorAfter);
    }
    type = Array.isArray(type) ? type[0] : type;
    if (type === "string") {
      value = convertToStringValue(value);
    }
    return this.getInsertTextForPlainText(value + separatorAfter);
  }

  private getInsertTemplateForValue(
    value: unknown | [],
    indent: string,
    navOrder: { index: number },
    separatorAfter: string
  ): string {
    if (Array.isArray(value)) {
      let insertText = "\n";
      for (const arrValue of value) {
        insertText += `${indent}- \${${navOrder.index++}:${arrValue}}\n`;
      }
      return insertText;
    } else if (typeof value === "object") {
      let insertText = "\n";
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const element = value[key as keyof typeof value];
          insertText += `${indent}\${${navOrder.index++}:${key}}:`;
          let valueTemplate;
          if (typeof element === "object") {
            valueTemplate = `${this.getInsertTemplateForValue(
              element,
              indent + this.indentation,
              navOrder,
              separatorAfter
            )}`;
          } else {
            valueTemplate = ` \${${navOrder.index++}:${this.getInsertTextForPlainText(element + separatorAfter)}}\n`;
          }
          insertText += `${valueTemplate}`;
        }
      }
      return insertText;
    }
    return this.getInsertTextForPlainText(value + separatorAfter);
  }

  private addSchemaValueCompletions(
    schema: JSONSchemaRef,
    separatorAfter: string,
    collector: CompletionsCollector,
    types: { [key: string]: boolean },
    completionType: "property" | "value",
    isArray?: boolean
  ): void {
    if (typeof schema === "object") {
      this.addEnumValueCompletions(schema, separatorAfter, collector, isArray);
      this.addDefaultValueCompletions(schema, separatorAfter, collector);
      this.collectTypes(schema, types);

      if (isArray && completionType === "value" && !isAnyOfAllOfOneOfType(schema)) {
        // add array only for final types (no anyOf, allOf, oneOf)
        this.addArrayItemValueCompletion(schema, separatorAfter, collector);
      }

      if (Array.isArray(schema.allOf)) {
        schema.allOf.forEach((s) => {
          return this.addSchemaValueCompletions(s, separatorAfter, collector, types, completionType, isArray);
        });
      }
      if (Array.isArray(schema.anyOf)) {
        schema.anyOf.forEach((s) => {
          return this.addSchemaValueCompletions(s, separatorAfter, collector, types, completionType, isArray);
        });
      }
      if (Array.isArray(schema.oneOf)) {
        schema.oneOf.forEach((s) => {
          return this.addSchemaValueCompletions(s, separatorAfter, collector, types, completionType, isArray);
        });
      }
    }
  }

  private collectTypes(schema: JSONSchema, types: { [key: string]: boolean }): void {
    if (Array.isArray(schema.enum) || isDefined(schema.const)) {
      return;
    }
    const type = schema.type;
    if (Array.isArray(type)) {
      type.forEach(function (t) {
        return (types[t] = true);
      });
    } else if (type) {
      types[type] = true;
    }
  }

  private addDefaultValueCompletions(
    schema: JSONSchema,
    separatorAfter: string,
    collector: CompletionsCollector,
    arrayDepth = 0
  ): void {
    let hasProposals = false;
    if (isDefined(schema.default)) {
      let type = schema.type;
      let value = schema.default;
      for (let i = arrayDepth; i > 0; i--) {
        value = [value];
        type = "array";
      }
      let label;
      if (typeof value == "object") {
        label = "Default value";
      } else {
        label = value.toString().replace(doubleQuotesEscapeRegExp, '"');
      }
      collector.add({
        kind: this.getSuggestionKind(type),
        label,
        insertText: this.getInsertTextForValue(value, separatorAfter, type),
        insertTextFormat: InsertTextFormat.Snippet,
        detail: "Default value",
      });
      hasProposals = true;
    }

    if (!hasProposals && typeof schema.items === "object" && !Array.isArray(schema.items)) {
      this.addDefaultValueCompletions(schema.items, separatorAfter, collector, arrayDepth + 1);
    }
  }

  private addEnumValueCompletions(
    schema: JSONSchema,
    separatorAfter: string,
    collector: CompletionsCollector,
    isArray?: boolean
  ): void {
    if (isDefined(schema.const) && !isArray) {
      collector.add({
        kind: this.getSuggestionKind(schema.type),
        label: this.getLabelForValue(schema.const),
        insertText: this.getInsertTextForValue(schema.const, separatorAfter, schema.type),
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: schema.description,
      });
    }
    if (Array.isArray(schema.enum)) {
      for (let i = 0, length = schema.enum.length; i < length; i++) {
        const enm = schema.enum[i];
        let documentation = schema.description;
        if (schema.enumDescriptions && i < schema.enumDescriptions.length) {
          documentation = schema.enumDescriptions[i];
        }
        collector.add({
          kind: this.getSuggestionKind(schema.type),
          label: this.getLabelForValue(enm),
          insertText: this.getInsertTextForValue(enm, separatorAfter, schema.type),
          insertTextFormat: InsertTextFormat.Snippet,
          documentation: documentation,
        });
      }
    }
  }

  private getLabelForValue(value: unknown): string {
    if (value === null) {
      return "null"; // return string with 'null' value if schema contains null as possible value
    }
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    return "" + value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getInsertTextForGuessedValue(value: any, separatorAfter: string, type?: string): string {
    switch (typeof value) {
      case "object":
        if (value === null) {
          return "${1:null}" + separatorAfter;
        }
        return this.getInsertTextForValue(value, separatorAfter, type);
      case "string": {
        let snippetValue = JSON.stringify(value);
        snippetValue = snippetValue.substr(1, snippetValue.length - 2); // remove quotes
        snippetValue = this.getInsertTextForPlainText(snippetValue); // escape \ and }
        if (type === "string") {
          snippetValue = convertToStringValue(snippetValue);
        }
        return "${1:" + snippetValue + "}" + separatorAfter;
      }
      case "number":
      case "boolean":
        return "${1:" + value + "}" + separatorAfter;
    }
    return this.getInsertTextForValue(value, separatorAfter, type);
  }

  private addBooleanValueCompletion(value: boolean, separatorAfter: string, collector: CompletionsCollector): void {
    collector.add({
      kind: this.getSuggestionKind("boolean"),
      label: value ? "true" : "false",
      insertText: this.getInsertTextForValue(value, separatorAfter, "boolean"),
      insertTextFormat: InsertTextFormat.Snippet,
      documentation: "",
    });
  }

  private addNullValueCompletion(separatorAfter: string, collector: CompletionsCollector): void {
    collector.add({
      kind: this.getSuggestionKind("null"),
      label: "null",
      insertText: "null" + separatorAfter,
      insertTextFormat: InsertTextFormat.Snippet,
      documentation: "",
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getSuggestionKind(type: any): CompletionItemKind {
    if (Array.isArray(type)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const array = <any[]>type;
      type = array.length > 0 ? array[0] : null;
    }
    if (!type) {
      return CompletionItemKind.Value;
    }
    switch (type) {
      case "string":
        return CompletionItemKind.Value;
      case "object":
        return CompletionItemKind.Module;
      case "property":
        return CompletionItemKind.Property;
      default:
        return CompletionItemKind.Value;
    }
  }

  private findItemAtOffset(seqNode: YAMLSeq, offset: number): number {
    for (let i = seqNode.items.length - 1; i >= 0; i--) {
      const node = seqNode.items[i];
      if (isNode(node)) {
        if (node.range) {
          if (offset > node.range[1]) {
            return i;
          } else if (offset >= node.range[0]) {
            return i;
          }
        }
      }
    }

    return 0;
  }
}

/**
 * simplify `{$1:value}` to `value`
 */
function evaluateTab1Symbol(value: string): string {
  return value.replace(/\$\{1:(.*)\}/, "$1");
}

function isParentCompletionItem(item: CompletionItemBase): item is CompletionItem {
  return "parent" in item;
}

function convertToStringValue(param: unknown): string {
  const isNumberExp = /^\d+$/;
  let value: string;
  if (typeof param === "string") {
    value = param;
  } else {
    value = "" + param;
  }
  if (value.length === 0) {
    return value;
  }

  if (value === "true" || value === "false" || value === "null" || isNumberExp.test(value)) {
    return `"${value}"`;
  }

  if (value.indexOf('"') !== -1) {
    value = value.replace(doubleQuotesEscapeRegExp, '"');
  }

  let doQuote = !isNaN(parseInt(value)) || value.charAt(0) === "@";

  if (!doQuote) {
    // need to quote value if in `foo: bar`, `foo : bar` (mapping) or `foo:` (partial map) format
    // but `foo:bar` and `:bar` (colon without white-space after it) are just plain string
    let idx = value.indexOf(":", 0);
    for (; idx > 0 && idx < value.length; idx = value.indexOf(":", idx + 1)) {
      if (idx === value.length - 1) {
        // `foo:` (partial map) format
        doQuote = true;
        break;
      }

      // there are only two valid kinds of white-space in yaml: space or tab
      // ref: https://yaml.org/spec/1.2.1/#id2775170
      const nextChar = value.charAt(idx + 1);
      if (nextChar === "\t" || nextChar === " ") {
        doQuote = true;
        break;
      }
    }
  }

  if (doQuote) {
    value = `"${value}"`;
  }

  return value;
}

export function isPrimitiveType(schema: JSONSchema): boolean {
  return schema.type !== "object" && !isAnyOfAllOfOneOfType(schema);
}

export function isAnyOfAllOfOneOfType(schema: JSONSchema): boolean {
  return !!(schema.anyOf || schema.allOf || schema.oneOf);
}

export function getSchemaTypeName(schema: JSONSchema): string {
  const closestTitleWithType = schema.type;
  if (schema.title) {
    return schema.title;
  }
  if (schema.$id) {
    return getSchemaRefTypeTitle(schema.$id);
  }
  if (schema.$ref) {
    return getSchemaRefTypeTitle(schema.$ref);
  }
  return (
    (Array.isArray(schema.type)
      ? schema.type.join(" | ")
      : closestTitleWithType
      ? schema.type?.concat("(", schema.title ?? "Unknown", ")")
      : schema.type ?? "Unknown") ?? "Unknown"
  );
}

export function getSchemaRefTypeTitle($ref: string): string {
  const match = $ref.match(/^(?:.*\/)?(.*?)(?:\.schema\.json)?$/);
  let type = !!match && match[1];
  if (!type) {
    type = "typeNotFound";
    console.error(`$ref (${$ref}) not parsed properly`);
  }
  return type;
}
