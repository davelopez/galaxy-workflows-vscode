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

export interface JSONSchema {
  id?: string;
  $schema?: string;
  type?: string | string[];
  title?: string;
  default?: any;
  definitions?: JSONSchemaMap;
  description?: string;
  properties?: JSONSchemaMap;
  patternProperties?: JSONSchemaMap;
  additionalProperties?: any;
  minProperties?: number;
  maxProperties?: number;
  dependencies?: JSONSchemaMap | string[];
  items?: any;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  additionalItems?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  multipleOf?: number;
  required?: string[];
  firstProperty?: string[];
  $ref?: string;
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;
  enum?: any[];
  format?: string;
  errorMessage?: string;
  patternErrorMessage?: string;
  deprecationMessage?: string;
  doNotSuggest?: boolean;
  enumDescriptions?: string[];
  ignoreCase?: string;
  aliases?: string[];
  document?: { [key: string]: string };
  $id?: string;
  insertText?: string;
  triggerSuggest?: boolean;
  // Extra
  url?: string;
  const?: any;
  contains?: JSONSchema;
}

export interface JSONSchemaMap {
  [name: string]: JSONSchema;
}

export type JSONSchemaRef = JSONSchema | boolean;

export class UnresolvedSchema {
  schema: JSONSchema;
  errors: string[];

  constructor(schema: JSONSchema, errors: string[] = []) {
    this.schema = schema;
    this.errors = errors;
  }
}

export class ResolvedSchema {
  schema: JSONSchema;
  errors: string[];

  constructor(schema: JSONSchema, errors: string[] = []) {
    this.schema = schema;
    this.errors = errors;
  }
}
