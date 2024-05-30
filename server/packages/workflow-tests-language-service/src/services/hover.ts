import { ASTNode } from "@gxwf/server-common/src/ast/types";
import {
  DocumentContext,
  Hover,
  MarkupContent,
  MarkupKind,
  Position,
  Range,
  WorkflowTestsDocument,
} from "@gxwf/server-common/src/languageTypes";
import { inject, injectable } from "inversify";
import { isAllSchemasMatched, isBoolean } from "../schema/adapter";
import { JSONSchemaRef } from "../schema/jsonSchema";
import { WorkflowTestsSchemaService } from "../schema/service";
import { TYPES } from "../types";

export interface WorkflowTestsHoverService {
  doHover(documentContext: DocumentContext, position: Position): Promise<Hover | null>;
}

@injectable()
export class WorkflowTestsHoverServiceImpl implements WorkflowTestsHoverService {
  constructor(@inject(TYPES.WorkflowTestsSchemaService) protected schemaService: WorkflowTestsSchemaService) {}

  public async doHover(documentContext: DocumentContext, position: Position): Promise<Hover | null> {
    const offset = documentContext.textDocument.offsetAt(position);
    let node = documentContext.nodeManager.getNodeFromOffset(offset);
    if (
      !node ||
      ((node.type === "object" || node.type === "array") &&
        offset > node.offset + 1 &&
        offset < node.offset + node.length - 1)
    ) {
      return Promise.resolve(null);
    }
    const hoverRangeNode = node;

    // use the property description when hovering over an object key
    if (node.type === "string") {
      const parent = node.parent;
      if (parent && parent.type === "property" && parent.keyNode === node) {
        node = parent.valueNode;
      }
    }

    if (!node) {
      return Promise.resolve(null);
    }

    const hoverRange = Range.create(
      documentContext.textDocument.positionAt(hoverRangeNode.offset),
      documentContext.textDocument.positionAt(hoverRangeNode.offset + hoverRangeNode.length)
    );

    if (this.parentPropertyMatchesKey(node, "job")) {
      const inputHover = await this.getHoverForWorkflowInput(documentContext, node, hoverRange);
      if (inputHover) {
        return inputHover;
      }
    }

    if (this.parentPropertyMatchesKey(node, "outputs")) {
      const outputHover = await this.getHoverForWorkflowOutput(documentContext, node, hoverRange);
      if (outputHover) {
        return outputHover;
      }
    }

    const matchingSchemas = this.schemaService.getMatchingSchemas(documentContext, node.offset);

    const removePipe = (value: string): string => {
      return value.replace(/\|\|\s*$/, "");
    };

    let title: string | undefined = undefined;
    let markdownDescription: string | undefined = undefined;

    matchingSchemas.every((matchingSchema) => {
      if (
        (matchingSchema.node === node || (node?.type === "property" && node.valueNode === matchingSchema.node)) &&
        matchingSchema.schema
      ) {
        title = title || matchingSchema.schema.title;
        markdownDescription = markdownDescription || matchingSchema.schema.description;
        if (matchingSchema.schema.anyOf && isAllSchemasMatched(node, matchingSchemas, matchingSchema.schema)) {
          title = "";
          markdownDescription = "";
          matchingSchema.schema.anyOf.forEach((childSchema: JSONSchemaRef, index: number) => {
            if (isBoolean(childSchema)) {
              return;
            }
            title += childSchema.title || "";
            markdownDescription += childSchema.description || "";
            const numOptions = matchingSchema.schema.anyOf ? matchingSchema.schema.anyOf.length - 1 : 0;
            if (index !== numOptions) {
              title += " || ";
              markdownDescription += " || ";
            }
          });
          title = removePipe(title);
          markdownDescription = removePipe(markdownDescription);
        }
      }
      return true;
    });
    let result = "";
    if (title) {
      result = `#### ${title}`;
    }
    if (markdownDescription) {
      if (result.length > 0) {
        result += "\n\n";
      }
      result += markdownDescription;
    }

    const contents = [result == "" ? "Nothing found" : result];
    const hover = this.createHover(contents.join("\n\n"), hoverRange);
    return Promise.resolve(hover);
  }

  private createHover(contents: string, hoverRange: Range): Hover {
    const markupContent: MarkupContent = {
      kind: MarkupKind.Markdown,
      value: contents,
    };
    const result: Hover = {
      contents: markupContent,
      range: hoverRange,
    };
    return result;
  }

  private parentPropertyMatchesKey(node: ASTNode, key: string): boolean {
    // The first parent is the value node (object), the second parent is the property node
    // we are looking for.
    // ParentNode (property) <- Target node
    //   |- ValueNode (object)
    //     |- Node (property) <- Initial node
    const parent = node.parent?.parent;
    if (!parent || parent.type !== "property") {
      return false;
    }
    return parent.keyNode.value === key;
  }

  private async getHoverForWorkflowInput(
    documentContext: DocumentContext,
    node: ASTNode,
    hoverRange: Range
  ): Promise<Hover | null> {
    if (node.type !== "property") {
      return null;
    }
    const key = node.keyNode.value;
    const testDocument = documentContext as WorkflowTestsDocument;
    const inputs = await testDocument.getWorkflowInputs();
    const matchingInput = inputs.find((input) => input.name === key);
    if (matchingInput) {
      const hoverContents = [`**${matchingInput.name}** (Input)`];
      if (matchingInput.doc) {
        hoverContents.push(matchingInput.doc);
      }
      if (matchingInput.type) {
        hoverContents.push(`Type: ${matchingInput.type}`);
      }
      return this.createHover(hoverContents.join("\n\n"), hoverRange);
    }
    return this.createHover("Input not found", hoverRange);
  }

  private async getHoverForWorkflowOutput(
    documentContext: DocumentContext,
    node: ASTNode,
    hoverRange: Range
  ): Promise<Hover | null> {
    if (node.type !== "property") {
      return null;
    }
    const key = node.keyNode.value;
    const testDocument = documentContext as WorkflowTestsDocument;
    const outputs = await testDocument.getWorkflowOutputs();
    const matchingOutput = outputs.find((output) => output.name === key);
    if (matchingOutput) {
      const hoverContents = [`**${matchingOutput.name}** (Output)`];
      if (matchingOutput.doc) {
        hoverContents.push(matchingOutput.doc);
      }
      if (matchingOutput.type) {
        hoverContents.push(`Type: ${matchingOutput.type}`);
      }
      if (matchingOutput.uuid) {
        hoverContents.push(matchingOutput.uuid);
      }
      return this.createHover(hoverContents.join("\n\n"), hoverRange);
    }
    return this.createHover("Output not found", hoverRange);
  }
}
