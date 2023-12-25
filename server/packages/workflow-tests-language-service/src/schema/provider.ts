/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Part of this code is based on https://github.com/redhat-developer/yaml-language-server/ with some
 * modifications to fit our needs.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { injectable } from "inversify";
import { JSONSchema, ResolvedSchema, UnresolvedSchema } from "./jsonSchema";
import WorkflowTestsSchema from "../../../../../workflow-languages/schemas/tests.schema.json";

export interface WorkflowTestsSchemaProvider {
  getResolvedSchema(): ResolvedSchema;
}

@injectable()
export class WorkflowTestsSchemaProviderImpl implements WorkflowTestsSchemaProvider {
  private readonly resolvedSchema: ResolvedSchema;

  constructor() {
    this.resolvedSchema = this.resolveSchemaContent(new UnresolvedSchema(WorkflowTestsSchema, []));
  }

  public getResolvedSchema(): ResolvedSchema {
    return this.resolvedSchema;
  }

  private resolveSchemaContent(schemaToResolve: UnresolvedSchema): ResolvedSchema {
    const resolveErrors: string[] = schemaToResolve.errors.slice(0);
    const schema = schemaToResolve.schema;

    const findSection = (schema: JSONSchema, path: string): any => {
      if (!path) {
        return schema;
      }
      let current: any = schema;
      if (path[0] === "/") {
        path = path.substring(1);
      }
      path.split("/").some((part) => {
        current = current[part];
        return !current;
      });
      return current;
    };

    const resolveLink = (node: any, linkedSchema: JSONSchema, linkPath: string): void => {
      const section = findSection(linkedSchema, linkPath);
      if (section) {
        for (const key in section) {
          if (Object.prototype.hasOwnProperty.call(section, key) && !Object.prototype.hasOwnProperty.call(node, key)) {
            node[key] = section[key];
          }
        }
      } else {
        resolveErrors.push(`json.schema.invalidref: $ref '${linkPath}' in ${linkedSchema.id} can not be resolved.`);
      }
      delete node.$ref;
    };

    const resolveRefs = (node: JSONSchema, parentSchema: JSONSchema): void => {
      if (!node) {
        return;
      }

      const toWalk: JSONSchema[] = [node];
      const seen: JSONSchema[] = [];

      const collectEntries = (...entries: JSONSchema[]): void => {
        for (const entry of entries) {
          if (typeof entry === "object") {
            toWalk.push(entry);
          }
        }
      };

      const collectMapEntries = (...maps: JSONSchema[]): void => {
        for (const map of maps) {
          if (typeof map === "object") {
            for (const key in map) {
              if (Object.prototype.hasOwnProperty.call(map, key)) {
                const entry = (map as any)[key];
                toWalk.push(entry);
              }
            }
          }
        }
      };

      const collectArrayEntries = (...arrays: JSONSchema[][]): void => {
        for (const array of arrays) {
          if (Array.isArray(array)) {
            toWalk.push(...array);
          }
        }
      };

      while (toWalk.length) {
        const next = toWalk.pop();
        if (!next) {
          break;
        }
        if (seen.indexOf(next) >= 0) {
          continue;
        }
        seen.push(next);
        if (next.$ref) {
          const segments = next.$ref.split("#", 2);
          resolveLink(next, parentSchema, segments[1]);
        }
        collectEntries(next.items, next.additionalProperties, next.not as any);
        collectMapEntries(
          next.definitions as JSONSchema,
          next.properties as JSONSchema,
          next.patternProperties as JSONSchema,
          next.dependencies as JSONSchema
        );
        collectArrayEntries(
          next.anyOf as JSONSchema[],
          next.allOf as JSONSchema[],
          next.oneOf as JSONSchema[],
          next.items as JSONSchema[]
        );
      }
    };
    resolveRefs(schema, schema);
    return new ResolvedSchema(schema, resolveErrors);
  }
}
