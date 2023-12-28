import {
  DocumentContext,
  Hover,
  MarkupContent,
  MarkupKind,
  Position,
  Range,
} from "@gxwf/server-common/src/languageTypes";
import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { isAllSchemasMatched, isBoolean } from "../schema/adapter";
import { JSONSchemaRef } from "../schema/jsonSchema";
import { WorkflowTestsSchemaService } from "../schema/service";

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
}
