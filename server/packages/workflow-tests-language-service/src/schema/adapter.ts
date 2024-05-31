/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Part of this code is based on https://github.com/redhat-developer/yaml-language-server/ with some
 * modifications to fit our needs.
 */

import {
  ASTNode,
  ArrayASTNode,
  NumberASTNode,
  ObjectASTNode,
  PropertyASTNode,
  StringASTNode,
} from "@gxwf/server-common/src/ast/types";
import { Diagnostic, DiagnosticSeverity, DocumentContext, Range } from "@gxwf/server-common/src/languageTypes";
import { injectable } from "inversify";
import { URI } from "vscode-uri";
import { JSONSchema, JSONSchemaRef } from "./jsonSchema";

const YAML_SCHEMA_PREFIX = "yaml-schema: ";
export const YAML_SOURCE = "YAML";

/**
 * Error codes used by diagnostics
 */
export enum ErrorCode {
  Undefined = 0,
  EnumValueMismatch = 1,
  Deprecated = 2,
  UnexpectedEndOfComment = 257,
  UnexpectedEndOfString = 258,
  UnexpectedEndOfNumber = 259,
  InvalidUnicode = 260,
  InvalidEscapeCharacter = 261,
  InvalidCharacter = 262,
  PropertyExpected = 513,
  CommaExpected = 514,
  ColonExpected = 515,
  ValueExpected = 516,
  CommaOrCloseBacketExpected = 517,
  CommaOrCloseBraceExpected = 518,
  TrailingComma = 519,
  DuplicateKey = 520,
  CommentNotPermitted = 521,
  PropertyKeysMustBeDoublequoted = 528,
  SchemaResolveError = 768,
  SchemaUnsupportedFeature = 769,
}

const propertyNotAllowedMessage = (property: string): string => `Property ${property} is not allowed.`;

const formats = {
  "color-hex": {
    errorMessage: "Invalid color format. Use #RGB, #RGBA, #RRGGBB or #RRGGBBAA.",
    pattern: /^#([0-9A-Fa-f]{3,4}|([0-9A-Fa-f]{2}){3,4})$/,
  },
  "date-time": {
    errorMessage: "String is not a RFC3339 date-time.",
    pattern:
      /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)([01][0-9]|2[0-3]):([0-5][0-9]))$/i,
  },
  date: {
    errorMessage: "String is not a RFC3339 date.",
    pattern: /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/i,
  },
  time: {
    errorMessage: "String is not a RFC3339 time.",
    pattern: /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)([01][0-9]|2[0-3]):([0-5][0-9]))$/i,
  },
  email: {
    errorMessage: "String is not an e-mail address.",
    pattern:
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  },
  ipv4: {
    errorMessage: "String does not match IPv4 format.",
    pattern: /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/,
  },
  ipv6: {
    errorMessage: "String does not match IPv6 format.",
    pattern: /^([0-9a-f]|:){1,4}(:([0-9a-f]{0,4})*){1,7}$/i,
  },
};

export interface IApplicableSchema {
  node: ASTNode;
  schema: JSONSchema;
}

interface ISchemaCollector {
  schemas: IApplicableSchema[];
  add(schema: IApplicableSchema): void;
  merge(other: ISchemaCollector): void;
  include(node: ASTNode): boolean;
  newSub(): ISchemaCollector;
}

class SchemaCollector implements ISchemaCollector {
  schemas: IApplicableSchema[] = [];
  constructor(
    private focusOffset = -1,
    private exclude: ASTNode | null = null
  ) {}
  add(schema: IApplicableSchema): void {
    this.schemas.push(schema);
  }
  merge(other: ISchemaCollector): void {
    this.schemas.push(...other.schemas);
  }
  include(node: ASTNode): boolean {
    return (this.focusOffset === -1 || contains(node, this.focusOffset)) && node !== this.exclude;
  }
  newSub(): ISchemaCollector {
    return new SchemaCollector(-1, this.exclude);
  }
}

class NoOpSchemaCollector implements ISchemaCollector {
  private constructor() {
    // ignore
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get schemas(): any[] {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  add(schema: IApplicableSchema): void {
    // ignore
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  merge(other: ISchemaCollector): void {
    // ignore
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  include(node: ASTNode): boolean {
    return true;
  }
  newSub(): ISchemaCollector {
    return this;
  }

  static instance = new NoOpSchemaCollector();
}

export function contains(node: ASTNode, offset: number, includeRightBound = false): boolean {
  return (
    (offset >= node.offset && offset <= node.offset + node.length) ||
    (includeRightBound && offset === node.offset + node.length)
  );
}

export interface JSONSchemaService {
  validate(
    documentContext: DocumentContext,
    schema: JSONSchema | undefined,
    severity?: DiagnosticSeverity,
    disableAdditionalProperties?: boolean
  ): Diagnostic[] | undefined;

  getMatchingSchemas(
    documentContext: DocumentContext,
    schema: JSONSchema,
    focusOffset?: number,
    exclude?: ASTNode | null,
    didCallFromAutoComplete?: boolean,
    disableAdditionalProperties?: boolean
  ): IApplicableSchema[];
}

@injectable()
export class JSONSchemaServiceImpl implements JSONSchemaService {
  public validate(
    documentContext: DocumentContext,
    schema: JSONSchema | undefined,
    severity: DiagnosticSeverity = DiagnosticSeverity.Warning,
    disableAdditionalProperties = false
  ): Diagnostic[] | undefined {
    const root = documentContext.nodeManager.root!;
    if (root && schema) {
      const validationResult = new ValidationResult();
      validate(root, schema, schema, validationResult, NoOpSchemaCollector.instance, {
        disableAdditionalProperties,
        uri: documentContext.textDocument.uri,
        callFromAutoComplete: false,
      });
      return validationResult.problems.map((p) => {
        const range = Range.create(
          documentContext.textDocument.positionAt(p.location.offset),
          documentContext.textDocument.positionAt(p.location.offset + p.location.length)
        );
        return Diagnostic.create(range, p.message, p.severity ?? severity, p.code);
      });
    }
    return undefined;
  }

  public getMatchingSchemas(
    documentContext: DocumentContext,
    schema: JSONSchema,
    focusOffset = -1,
    exclude: ASTNode | null = null,
    didCallFromAutoComplete?: boolean,
    disableAdditionalProperties = false
  ): IApplicableSchema[] {
    const root = documentContext.nodeManager.root!;
    const matchingSchemas = new SchemaCollector(focusOffset, exclude);
    if (root && schema) {
      validate(root, schema, schema, new ValidationResult(), matchingSchemas, {
        disableAdditionalProperties,
        uri: documentContext.textDocument.uri,
        callFromAutoComplete: didCallFromAutoComplete,
      });
    }
    return matchingSchemas.schemas;
  }
}

enum ProblemType {
  missingRequiredPropWarning = "missingRequiredPropWarning",
  typeMismatchWarning = "typeMismatchWarning",
  constWarning = "constWarning",
}

const ProblemTypeMessages: Record<ProblemType, string> = {
  [ProblemType.missingRequiredPropWarning]: 'Missing property "{0}".',
  [ProblemType.typeMismatchWarning]: 'Incorrect type. Expected "{0}".',
  [ProblemType.constWarning]: "Value must be {0}.",
};

function getWarningMessage(problemType?: ProblemType, args?: string[]): string {
  if (!problemType) {
    throw new Error("Unknown problem type while getting warning message");
  }
  if (!args) {
    throw new Error("No arguments while getting warning message");
  }
  return ProblemTypeMessages[problemType].replace("{0}", args.join(" | "));
}

interface IRange {
  offset: number;
  length: number;
}

interface IProblem {
  location: IRange;
  severity: DiagnosticSeverity;
  code?: ErrorCode;
  message: string;
  source: string;
  problemType?: ProblemType;
  problemArgs?: string[];
  schemaUri: string[];
  data?: Record<string, unknown>;
}

export function isArrayEqual(fst?: Array<unknown>, snd?: Array<unknown>): boolean {
  if (!snd || !fst) {
    return false;
  }
  if (snd.length !== fst.length) {
    return false;
  }
  for (let index = fst.length - 1; index >= 0; index--) {
    if (fst[index] !== snd[index]) {
      return false;
    }
  }
  return true;
}

export class ValidationResult {
  public problems: IProblem[];

  public propertiesMatches: number;
  public propertiesValueMatches: number;
  public primaryValueMatches: number;
  public enumValueMatch: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public enumValues: any[];

  constructor() {
    this.problems = [];
    this.propertiesMatches = 0;
    this.propertiesValueMatches = 0;
    this.primaryValueMatches = 0;
    this.enumValueMatch = false;
    this.enumValues = [];
  }

  public hasProblems(): boolean {
    return !!this.problems.length;
  }

  public mergeAll(validationResults: ValidationResult[]): void {
    for (const validationResult of validationResults) {
      this.merge(validationResult);
    }
  }

  public merge(validationResult: ValidationResult): void {
    this.problems = this.problems.concat(validationResult.problems);
  }

  public mergeEnumValues(validationResult: ValidationResult): void {
    if (!this.enumValueMatch && !validationResult.enumValueMatch && this.enumValues && validationResult.enumValues) {
      this.enumValues = this.enumValues.concat(validationResult.enumValues);
      for (const error of this.problems) {
        if (error.code === ErrorCode.EnumValueMismatch) {
          error.message = `Value is not accepted. Valid values: ${[...new Set(this.enumValues)]
            .map((v) => {
              return JSON.stringify(v);
            })
            .join(", ")}.`;
        }
      }
    }
  }

  /**
   * Merge multiple warnings with same problemType together
   * @param subValidationResult another possible result
   */
  public mergeWarningGeneric(subValidationResult: ValidationResult, problemTypesToMerge: ProblemType[]): void {
    if (this.problems?.length) {
      for (const problemType of problemTypesToMerge) {
        const bestResults = this.problems.filter((p) => p.problemType === problemType);
        for (const bestResult of bestResults) {
          const mergingResult = subValidationResult.problems?.find(
            (p) =>
              p.problemType === problemType &&
              bestResult.location.offset === p.location.offset &&
              (problemType !== ProblemType.missingRequiredPropWarning ||
                isArrayEqual(p.problemArgs, bestResult.problemArgs)) // missingProp is merged only with same problemArg
          );
          if (mergingResult) {
            if (mergingResult.problemArgs?.length) {
              mergingResult.problemArgs
                .filter((p) => !bestResult.problemArgs?.includes(p))
                .forEach((p) => bestResult.problemArgs?.push(p));
              bestResult.message = getWarningMessage(bestResult.problemType, bestResult.problemArgs);
            }
            this.mergeSources(mergingResult, bestResult);
          }
        }
      }
    }
  }

  public mergePropertyMatch(propertyValidationResult: ValidationResult): void {
    this.merge(propertyValidationResult);
    this.propertiesMatches++;
    if (
      propertyValidationResult.enumValueMatch ||
      (!propertyValidationResult.hasProblems() && propertyValidationResult.propertiesMatches)
    ) {
      this.propertiesValueMatches++;
    }
    if (propertyValidationResult.enumValueMatch && propertyValidationResult.enumValues) {
      this.primaryValueMatches++;
    }
  }

  private mergeSources(mergingResult: IProblem, bestResult: IProblem): void {
    const mergingSource = mergingResult.source.replace(YAML_SCHEMA_PREFIX, "");
    if (!bestResult.source.includes(mergingSource)) {
      bestResult.source = bestResult.source + " | " + mergingSource;
    }
    if (!bestResult.schemaUri.includes(mergingResult.schemaUri[0])) {
      bestResult.schemaUri = bestResult.schemaUri.concat(mergingResult.schemaUri);
    }
  }

  public compareGeneric(other: ValidationResult): number {
    const hasProblems = this.hasProblems();
    if (hasProblems !== other.hasProblems()) {
      return hasProblems ? -1 : 1;
    }
    if (this.enumValueMatch !== other.enumValueMatch) {
      return other.enumValueMatch ? -1 : 1;
    }
    if (this.propertiesValueMatches !== other.propertiesValueMatches) {
      return this.propertiesValueMatches - other.propertiesValueMatches;
    }
    if (this.primaryValueMatches !== other.primaryValueMatches) {
      return this.primaryValueMatches - other.primaryValueMatches;
    }
    return this.propertiesMatches - other.propertiesMatches;
  }

  public compareKubernetes(other: ValidationResult): number {
    const hasProblems = this.hasProblems();
    if (this.propertiesMatches !== other.propertiesMatches) {
      return this.propertiesMatches - other.propertiesMatches;
    }
    if (this.enumValueMatch !== other.enumValueMatch) {
      return other.enumValueMatch ? -1 : 1;
    }
    if (this.primaryValueMatches !== other.primaryValueMatches) {
      return this.primaryValueMatches - other.primaryValueMatches;
    }
    if (this.propertiesValueMatches !== other.propertiesValueMatches) {
      return this.propertiesValueMatches - other.propertiesValueMatches;
    }
    if (hasProblems !== other.hasProblems()) {
      return hasProblems ? -1 : 1;
    }
    return this.propertiesMatches - other.propertiesMatches;
  }
}

interface Options {
  disableAdditionalProperties: boolean;
  uri: string;
  callFromAutoComplete?: boolean;
}

export function asSchema(schema?: JSONSchemaRef): JSONSchema | undefined {
  if (schema === undefined) {
    return undefined;
  }

  if (isBoolean(schema)) {
    return schema ? {} : { not: {} };
  }

  if (typeof schema !== "object") {
    // we need to report this case as JSONSchemaRef MUST be an Object or Boolean
    console.warn(`Wrong schema: ${JSON.stringify(schema)}, it MUST be an Object or Boolean`);
    schema = {
      type: schema,
    };
  }
  if (schema.$ref) {
    console.debug(`DEF ${schema.$ref}`);
  }
  return schema;
}

function getSchemaSource(schema: JSONSchema): string {
  let label: string | undefined = undefined;
  if (schema) {
    if (schema.title) {
      label = schema.title;
      return `${YAML_SCHEMA_PREFIX}${label}`;
    }
  }

  return YAML_SOURCE;
}

function getSchemaUri(schema: JSONSchema, originalSchema: JSONSchema): string[] {
  const uriString = schema.url ?? originalSchema.url;
  return uriString ? [uriString] : [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getNodeValue(node: ASTNode): any {
  switch (node.type) {
    case "array":
      return node.children.map(getNodeValue);
    case "object": {
      const obj = Object.create(null);
      for (let _i = 0, _a = node.children; _i < _a.length; _i++) {
        const prop = _a[_i];
        const valueNode = prop.children && prop.children[1];
        if (valueNode) {
          obj[prop.children[0].value as string] = getNodeValue(valueNode);
        }
      }
      return obj;
    }
    case "null":
    case "string":
    case "number":
    case "boolean":
      return node.value;
    default:
      return undefined;
  }
}

function validate(
  node: ASTNode,
  schema: JSONSchema | undefined,
  originalSchema: JSONSchema,
  validationResult: ValidationResult,
  matchingSchemas: ISchemaCollector,
  options: Options
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const { callFromAutoComplete } = options;
  if (!node) {
    return;
  }

  // schema should be an Object
  if (typeof schema !== "object") {
    return;
  }

  if (!schema.url) {
    schema.url = originalSchema.url;
  }

  switch (node.type) {
    case "object":
      _validateObjectNode(node, schema, validationResult, matchingSchemas);
      break;
    case "array":
      _validateArrayNode(node, schema, validationResult, matchingSchemas);
      break;
    case "string":
      _validateStringNode(node, schema, validationResult);
      break;
    case "number":
      _validateNumberNode(node, schema, validationResult);
      break;
    case "property":
      return validate(node.valueNode!, schema, schema, validationResult, matchingSchemas, options);
  }
  _validateNode();

  matchingSchemas.add({ node: node, schema: schema });

  function _validateNode(): void {
    if (schema === undefined) {
      return;
    }

    function matchesType(type: string): boolean {
      return node.type === type || (type === "integer" && node.type === "number" && node.isInteger);
    }

    if (Array.isArray(schema.type)) {
      if (!schema.type.some(matchesType)) {
        validationResult.problems.push({
          location: { offset: node.offset, length: node.length },
          severity: DiagnosticSeverity.Warning,
          message: schema.errorMessage || `Incorrect type. Expected one of ${(<string[]>schema.type).join(", ")}.`,
          source: getSchemaSource(schema),
          schemaUri: getSchemaUri(schema, originalSchema),
          problemType: ProblemType.typeMismatchWarning,
          problemArgs: [(<string[]>schema.type).join(", ")],
        });
      }
    } else if (schema.type) {
      if (!matchesType(schema.type)) {
        //get more specific name than just object
        const schemaType = schema.type === "object" ? schema.title ?? "" : schema.type;
        validationResult.problems.push({
          location: { offset: node.offset, length: node.length },
          severity: DiagnosticSeverity.Warning,
          message: schema.errorMessage || getWarningMessage(ProblemType.typeMismatchWarning, [schemaType]),
          source: getSchemaSource(schema),
          schemaUri: getSchemaUri(schema, originalSchema),
          problemType: ProblemType.typeMismatchWarning,
          problemArgs: [schemaType],
        });
      }
    }
    if (Array.isArray(schema.allOf)) {
      for (const subSchemaRef of schema.allOf) {
        validate(node, asSchema(subSchemaRef), schema, validationResult, matchingSchemas, options);
      }
    }
  }

  const testAlternatives = (alternatives: JSONSchemaRef[], maxOneMatch: boolean): number => {
    const matches = [];
    const subMatches = [];
    const noPropertyMatches = [];
    // remember the best match that is used for error messages
    let bestMatch: {
      schema: JSONSchema;
      validationResult: ValidationResult;
      matchingSchemas: ISchemaCollector;
    } | null = null;
    for (const subSchemaRef of alternatives) {
      const subSchema = { ...asSchema(subSchemaRef) };
      const subValidationResult = new ValidationResult();
      const subMatchingSchemas = matchingSchemas.newSub();
      validate(node, subSchema, schema!, subValidationResult, subMatchingSchemas, options);
      if (!subValidationResult.hasProblems() || callFromAutoComplete) {
        matches.push(subSchema);
        subMatches.push(subSchema);
        if (subValidationResult.propertiesMatches === 0) {
          noPropertyMatches.push(subSchema);
        }
        if (subSchema.format) {
          subMatches.pop();
        }
      }
      if (!bestMatch) {
        bestMatch = {
          schema: subSchema,
          validationResult: subValidationResult,
          matchingSchemas: subMatchingSchemas,
        };
      } else {
        bestMatch = genericComparison(node, maxOneMatch, subValidationResult, bestMatch, subSchema, subMatchingSchemas);
      }
    }

    if (subMatches.length > 1 && (subMatches.length > 1 || noPropertyMatches.length === 0) && maxOneMatch) {
      validationResult.problems.push({
        location: { offset: node.offset, length: 1 },
        severity: DiagnosticSeverity.Warning,
        message: "Matches multiple schemas when only one must validate.",
        source: getSchemaSource(schema!),
        schemaUri: getSchemaUri(schema!, originalSchema),
        problemArgs: [subMatches.map((s) => getSchemaSource(s)).join(", ")],
        problemType: ProblemType.typeMismatchWarning,
      });
    }
    if (bestMatch !== null) {
      validationResult.merge(bestMatch.validationResult);
      validationResult.propertiesMatches += bestMatch.validationResult.propertiesMatches;
      validationResult.propertiesValueMatches += bestMatch.validationResult.propertiesValueMatches;
      validationResult.enumValueMatch = validationResult.enumValueMatch || bestMatch.validationResult.enumValueMatch;
      if (bestMatch.validationResult.enumValues?.length) {
        validationResult.enumValues = (validationResult.enumValues || []).concat(bestMatch.validationResult.enumValues);
      }
      matchingSchemas.merge(bestMatch.matchingSchemas);
    }
    return matches.length;
  };
  if (Array.isArray(schema.anyOf)) {
    testAlternatives(schema.anyOf, false);
  }
  if (Array.isArray(schema.oneOf)) {
    testAlternatives(schema.oneOf, true);
  }

  if (Array.isArray(schema.enum)) {
    const val = getNodeValue(node);
    let enumValueMatch = false;
    for (const e of schema.enum) {
      if (equals(val, e) || (callFromAutoComplete && isString(val) && isString(e) && val && e.startsWith(val))) {
        enumValueMatch = true;
        break;
      }
    }
    validationResult.enumValues = schema.enum;
    validationResult.enumValueMatch = enumValueMatch;
    if (!enumValueMatch) {
      validationResult.problems.push({
        location: { offset: node.offset, length: node.length },
        severity: DiagnosticSeverity.Warning,
        code: ErrorCode.EnumValueMismatch,
        message:
          schema.errorMessage ||
          `Value is not accepted. Valid values: ${schema.enum
            .map((v) => {
              return JSON.stringify(v);
            })
            .join(", ")}.`,
        source: getSchemaSource(schema),
        schemaUri: getSchemaUri(schema, originalSchema),
      });
    }
  }

  if (isDefined(schema.const)) {
    const val = getNodeValue(node);
    if (
      !equals(val, schema.const) &&
      !(callFromAutoComplete && isString(val) && isString(schema.const) && schema.const.startsWith(val))
    ) {
      validationResult.problems.push({
        location: { offset: node.offset, length: node.length },
        severity: DiagnosticSeverity.Warning,
        code: ErrorCode.EnumValueMismatch,
        problemType: ProblemType.constWarning,
        message: schema.errorMessage || getWarningMessage(ProblemType.constWarning, [JSON.stringify(schema.const)]),
        source: getSchemaSource(schema),
        schemaUri: getSchemaUri(schema, originalSchema),
        problemArgs: [JSON.stringify(schema.const)],
      });
      validationResult.enumValueMatch = false;
    } else {
      validationResult.enumValueMatch = true;
    }
    validationResult.enumValues = [schema.const];
  }

  if (schema.deprecationMessage && node.parent) {
    validationResult.problems.push({
      location: { offset: node.parent.offset, length: node.parent.length },
      severity: DiagnosticSeverity.Warning,
      message: schema.deprecationMessage,
      source: getSchemaSource(schema),
      schemaUri: getSchemaUri(schema, originalSchema),
    });
  }

  function _validateNumberNode(node: NumberASTNode, schema: JSONSchema, validationResult: ValidationResult): void {
    const val = node.value;

    if (isNumber(schema.multipleOf)) {
      if (val % schema.multipleOf !== 0) {
        validationResult.problems.push({
          location: { offset: node.offset, length: node.length },
          severity: DiagnosticSeverity.Warning,
          message: `Value is not divisible by ${schema.multipleOf}.`,
          source: getSchemaSource(schema),
          schemaUri: getSchemaUri(schema, originalSchema),
        });
      }
    }
    function getExclusiveLimit(limit: number | undefined, exclusive: boolean | number | undefined): number | undefined {
      if (isNumber(exclusive)) {
        return exclusive;
      }
      if (isBoolean(exclusive) && exclusive) {
        return limit;
      }
      return undefined;
    }
    function getLimit(limit: number | undefined, exclusive: boolean | number | undefined): number | undefined {
      if (!isBoolean(exclusive) || !exclusive) {
        return limit;
      }
      return undefined;
    }
    const exclusiveMinimum = getExclusiveLimit(schema.minimum, schema.exclusiveMinimum);
    if (isNumber(exclusiveMinimum) && val <= exclusiveMinimum) {
      validationResult.problems.push({
        location: { offset: node.offset, length: node.length },
        severity: DiagnosticSeverity.Warning,
        message: `Value is below the exclusive minimum of ${exclusiveMinimum}.`,
        source: getSchemaSource(schema),
        schemaUri: getSchemaUri(schema, originalSchema),
      });
    }
    const exclusiveMaximum = getExclusiveLimit(schema.maximum, schema.exclusiveMaximum);
    if (isNumber(exclusiveMaximum) && val >= exclusiveMaximum) {
      validationResult.problems.push({
        location: { offset: node.offset, length: node.length },
        severity: DiagnosticSeverity.Warning,
        message: `Value is above the exclusive maximum of ${exclusiveMaximum}.`,
        source: getSchemaSource(schema),
        schemaUri: getSchemaUri(schema, originalSchema),
      });
    }
    const minimum = getLimit(schema.minimum, schema.exclusiveMinimum);
    if (isNumber(minimum) && val < minimum) {
      validationResult.problems.push({
        location: { offset: node.offset, length: node.length },
        severity: DiagnosticSeverity.Warning,
        message: `Value is below the minimum of ${minimum}.`,
        source: getSchemaSource(schema),
        schemaUri: getSchemaUri(schema, originalSchema),
      });
    }
    const maximum = getLimit(schema.maximum, schema.exclusiveMaximum);
    if (isNumber(maximum) && val > maximum) {
      validationResult.problems.push({
        location: { offset: node.offset, length: node.length },
        severity: DiagnosticSeverity.Warning,
        message: `Value is below the maximum of ${maximum}.`,
        source: getSchemaSource(schema),
        schemaUri: getSchemaUri(schema, originalSchema),
      });
    }
  }

  function _validateStringNode(node: StringASTNode, schema: JSONSchema, validationResult: ValidationResult): void {
    if (isNumber(schema.minLength) && node.value.length < schema.minLength) {
      validationResult.problems.push({
        location: { offset: node.offset, length: node.length },
        severity: DiagnosticSeverity.Warning,
        message: `String is shorter than the minimum length of ${schema.minLength}.`,
        source: getSchemaSource(schema),
        schemaUri: getSchemaUri(schema, originalSchema),
      });
    }

    if (isNumber(schema.maxLength) && node.value.length > schema.maxLength) {
      validationResult.problems.push({
        location: { offset: node.offset, length: node.length },
        severity: DiagnosticSeverity.Warning,
        message: `String is longer than the maximum length of ${schema.maxLength}.`,
        source: getSchemaSource(schema),
        schemaUri: getSchemaUri(schema, originalSchema),
      });
    }

    if (isString(schema.pattern)) {
      const regex = safeCreateUnicodeRegExp(schema.pattern);
      if (!regex.test(node.value)) {
        validationResult.problems.push({
          location: { offset: node.offset, length: node.length },
          severity: DiagnosticSeverity.Warning,
          message:
            schema.patternErrorMessage ||
            schema.errorMessage ||
            `String does not match the pattern of "${schema.pattern}".`,
          source: getSchemaSource(schema),
          schemaUri: getSchemaUri(schema, originalSchema),
        });
      }
    }

    if (schema.format) {
      switch (schema.format) {
        case "uri":
        case "uri-reference":
          {
            let errorMessage;
            if (!node.value) {
              errorMessage = "URI expected.";
            } else {
              try {
                const uri = URI.parse(node.value);
                if (!uri.scheme && schema.format === "uri") {
                  errorMessage = "URI with a scheme is expected.";
                }
              } catch (e) {
                errorMessage = (e as Error).message;
              }
            }
            if (errorMessage) {
              validationResult.problems.push({
                location: { offset: node.offset, length: node.length },
                severity: DiagnosticSeverity.Warning,
                message: schema.patternErrorMessage || schema.errorMessage || `String is not a URI: ${errorMessage}`,
                source: getSchemaSource(schema),
                schemaUri: getSchemaUri(schema, originalSchema),
              });
            }
          }
          break;
        case "color-hex":
        case "date-time":
        case "date":
        case "time":
        case "email":
        case "ipv4":
        case "ipv6":
          {
            const format = formats[schema.format];
            if (!node.value || !format.pattern.test(node.value)) {
              validationResult.problems.push({
                location: { offset: node.offset, length: node.length },
                severity: DiagnosticSeverity.Warning,
                message: schema.patternErrorMessage || schema.errorMessage || format.errorMessage,
                source: getSchemaSource(schema),
                schemaUri: getSchemaUri(schema, originalSchema),
              });
            }
          }
          break;
        default:
      }
    }
  }
  function _validateArrayNode(
    node: ArrayASTNode,
    schema: JSONSchema,
    validationResult: ValidationResult,
    matchingSchemas: ISchemaCollector
  ): void {
    if (Array.isArray(schema.items)) {
      const subSchemas = schema.items;
      for (let index = 0; index < subSchemas.length; index++) {
        const subSchemaRef = subSchemas[index];
        const subSchema = asSchema(subSchemaRef);
        const itemValidationResult = new ValidationResult();
        const item = node.items[index];
        if (item) {
          validate(item, subSchema, schema, itemValidationResult, matchingSchemas, options);
          validationResult.mergePropertyMatch(itemValidationResult);
          validationResult.mergeEnumValues(itemValidationResult);
        } else if (node.items.length >= subSchemas.length) {
          validationResult.propertiesValueMatches++;
        }
      }
      if (node.items.length > subSchemas.length) {
        if (typeof schema.additionalItems === "object") {
          for (let i = subSchemas.length; i < node.items.length; i++) {
            const itemValidationResult = new ValidationResult();
            validate(
              node.items[i],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <any>schema.additionalItems,
              schema,
              itemValidationResult,
              matchingSchemas,
              options
            );
            validationResult.mergePropertyMatch(itemValidationResult);
            validationResult.mergeEnumValues(itemValidationResult);
          }
        } else if (schema.additionalItems === false) {
          validationResult.problems.push({
            location: { offset: node.offset, length: node.length },
            severity: DiagnosticSeverity.Warning,
            message: `Array has too many items according to schema. Expected ${subSchemas.length} or fewer.`,
            source: getSchemaSource(schema),
            schemaUri: getSchemaUri(schema, originalSchema),
          });
        }
      }
    } else {
      const itemSchema = asSchema(schema.items);
      if (itemSchema) {
        const itemValidationResult = new ValidationResult();
        node.items.forEach((item) => {
          if (itemSchema.oneOf && itemSchema.oneOf.length === 1) {
            const subSchemaRef = itemSchema.oneOf[0];
            const subSchema = { ...asSchema(subSchemaRef) };
            subSchema.title = schema.title;
            // subSchema.closestTitle = schema.closestTitle;
            validate(item, subSchema, schema, itemValidationResult, matchingSchemas, options);
            validationResult.mergePropertyMatch(itemValidationResult);
            validationResult.mergeEnumValues(itemValidationResult);
          } else {
            validate(item, itemSchema, schema, itemValidationResult, matchingSchemas, options);
            validationResult.mergePropertyMatch(itemValidationResult);
            validationResult.mergeEnumValues(itemValidationResult);
          }
        });
      }
    }

    const containsSchema = asSchema(schema.contains);
    if (containsSchema) {
      const doesContain = node.items.some((item) => {
        const itemValidationResult = new ValidationResult();
        validate(item, containsSchema, schema, itemValidationResult, NoOpSchemaCollector.instance, options);
        return !itemValidationResult.hasProblems();
      });

      if (!doesContain) {
        validationResult.problems.push({
          location: { offset: node.offset, length: node.length },
          severity: DiagnosticSeverity.Warning,
          message: schema.errorMessage || "Array does not contain required item.",
          source: getSchemaSource(schema),
          schemaUri: getSchemaUri(schema, originalSchema),
        });
      }
    }

    if (isNumber(schema.minItems) && node.items.length < schema.minItems) {
      validationResult.problems.push({
        location: { offset: node.offset, length: node.length },
        severity: DiagnosticSeverity.Warning,
        message: `Array has too few items. Expected ${schema.minItems} or more.`,
        source: getSchemaSource(schema),
        schemaUri: getSchemaUri(schema, originalSchema),
      });
    }

    if (isNumber(schema.maxItems) && node.items.length > schema.maxItems) {
      validationResult.problems.push({
        location: { offset: node.offset, length: node.length },
        severity: DiagnosticSeverity.Warning,
        message: `Array has too many items. Expected ${schema.maxItems} or fewer.`,
        source: getSchemaSource(schema),
        schemaUri: getSchemaUri(schema, originalSchema),
      });
    }

    if (schema.uniqueItems === true) {
      const values: unknown[] = getNodeValue(node);
      const duplicates = values.some((value, index) => {
        return index !== values.lastIndexOf(value);
      });
      if (duplicates) {
        validationResult.problems.push({
          location: { offset: node.offset, length: node.length },
          severity: DiagnosticSeverity.Warning,
          message: "Array has duplicate items.",
          source: getSchemaSource(schema),
          schemaUri: getSchemaUri(schema, originalSchema),
        });
      }
    }
  }

  function _validateObjectNode(
    node: ObjectASTNode,
    schema: JSONSchema,
    validationResult: ValidationResult,
    matchingSchemas: ISchemaCollector
  ): void {
    const seenKeys: { [key: string]: ASTNode } = Object.create(null);
    const unprocessedProperties: string[] = [];
    const unprocessedNodes: PropertyASTNode[] = [...node.properties];

    while (unprocessedNodes.length > 0) {
      const propertyNode = unprocessedNodes.pop();
      if (!propertyNode) {
        continue;
      }
      const key = propertyNode.keyNode.value;

      //Replace the merge key with the actual values of what the node value points to in seen keys
      if (key === "<<" && propertyNode.valueNode) {
        switch (propertyNode.valueNode.type) {
          case "object": {
            unprocessedNodes.push(...propertyNode.valueNode["properties"]);
            break;
          }
          case "array": {
            propertyNode.valueNode["items"].forEach((sequenceNode) => {
              if (sequenceNode && isIterable((sequenceNode as ObjectASTNode)["properties"])) {
                unprocessedNodes.push(...(sequenceNode as ObjectASTNode)["properties"]);
              }
            });
            break;
          }
          default: {
            break;
          }
        }
      } else {
        seenKeys[key] = propertyNode.valueNode as ASTNode;
        unprocessedProperties.push(key);
      }
    }

    if (Array.isArray(schema.required)) {
      for (const propertyName of schema.required) {
        if (seenKeys[propertyName] === undefined) {
          const keyNode = node.parent && node.parent.type === "property" && node.parent.keyNode;
          const location = keyNode
            ? { offset: keyNode.offset, length: keyNode.length }
            : { offset: node.offset, length: 1 };
          validationResult.problems.push({
            location: location,
            severity: DiagnosticSeverity.Warning,
            message: getWarningMessage(ProblemType.missingRequiredPropWarning, [propertyName]),
            source: getSchemaSource(schema),
            schemaUri: getSchemaUri(schema, originalSchema),
            problemArgs: [propertyName],
            problemType: ProblemType.missingRequiredPropWarning,
          });
        }
      }
    }

    const propertyProcessed = (prop: string): void => {
      let index = unprocessedProperties.indexOf(prop);
      while (index >= 0) {
        unprocessedProperties.splice(index, 1);
        index = unprocessedProperties.indexOf(prop);
      }
    };

    if (schema.properties) {
      for (const propertyName of Object.keys(schema.properties)) {
        propertyProcessed(propertyName);
        const propertySchema = schema.properties[propertyName];
        const child = seenKeys[propertyName];
        if (child) {
          if (isBoolean(propertySchema)) {
            if (!propertySchema) {
              const propertyNode = <PropertyASTNode>child.parent;
              validationResult.problems.push({
                location: {
                  offset: propertyNode.keyNode.offset,
                  length: propertyNode.keyNode.length,
                },
                severity: DiagnosticSeverity.Warning,
                message: schema.errorMessage || propertyNotAllowedMessage(propertyName),
                source: getSchemaSource(schema),
                schemaUri: getSchemaUri(schema, originalSchema),
              });
            } else {
              validationResult.propertiesMatches++;
              validationResult.propertiesValueMatches++;
            }
          } else {
            propertySchema.url = schema.url ?? originalSchema.url;
            const propertyValidationResult = new ValidationResult();
            validate(child, propertySchema, schema, propertyValidationResult, matchingSchemas, options);
            validationResult.mergePropertyMatch(propertyValidationResult);
            validationResult.mergeEnumValues(propertyValidationResult);
          }
        }
      }
    }

    if (schema.patternProperties) {
      for (const propertyPattern of Object.keys(schema.patternProperties)) {
        const regex = safeCreateUnicodeRegExp(propertyPattern);
        for (const propertyName of unprocessedProperties.slice(0)) {
          if (regex.test(propertyName)) {
            propertyProcessed(propertyName);
            const child = seenKeys[propertyName];
            if (child) {
              const propertySchema = schema.patternProperties[propertyPattern];
              if (isBoolean(propertySchema)) {
                if (!propertySchema) {
                  const propertyNode = <PropertyASTNode>child.parent;
                  validationResult.problems.push({
                    location: {
                      offset: propertyNode.keyNode.offset,
                      length: propertyNode.keyNode.length,
                    },
                    severity: DiagnosticSeverity.Warning,
                    message: schema.errorMessage || propertyNotAllowedMessage(propertyName),
                    source: getSchemaSource(schema),
                    schemaUri: getSchemaUri(schema, originalSchema),
                  });
                } else {
                  validationResult.propertiesMatches++;
                  validationResult.propertiesValueMatches++;
                }
              } else {
                const propertyValidationResult = new ValidationResult();
                validate(child, propertySchema, schema, propertyValidationResult, matchingSchemas, options);
                validationResult.mergePropertyMatch(propertyValidationResult);
                validationResult.mergeEnumValues(propertyValidationResult);
              }
            }
          }
        }
      }
    }
    if (typeof schema.additionalProperties === "object") {
      for (const propertyName of unprocessedProperties) {
        const child = seenKeys[propertyName];
        if (child) {
          const propertyValidationResult = new ValidationResult();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          validate(child, <any>schema.additionalProperties, schema, propertyValidationResult, matchingSchemas, options);
          validationResult.mergePropertyMatch(propertyValidationResult);
          validationResult.mergeEnumValues(propertyValidationResult);
        }
      }
    } else if (
      schema.additionalProperties === false ||
      (schema.type === "object" &&
        schema.additionalProperties === undefined &&
        options.disableAdditionalProperties === true)
    ) {
      if (unprocessedProperties.length > 0) {
        const possibleProperties =
          schema.properties && Object.keys(schema.properties).filter((prop) => !seenKeys[prop]);

        for (const propertyName of unprocessedProperties) {
          const child = seenKeys[propertyName];
          if (child) {
            let propertyNode = null;
            if (child.type !== "property") {
              propertyNode = child.parent as ASTNode;
              if (propertyNode.type === "object") {
                propertyNode = propertyNode.properties[0];
              }
            } else {
              propertyNode = child;
            }
            const problem: IProblem = {
              location: {
                offset: (propertyNode as PropertyASTNode).keyNode.offset,
                length: (propertyNode as PropertyASTNode).keyNode.length,
              },
              severity: DiagnosticSeverity.Warning,
              message: schema.errorMessage || propertyNotAllowedMessage(propertyName),
              source: getSchemaSource(schema),
              schemaUri: getSchemaUri(schema, originalSchema),
            };
            if (possibleProperties?.length) {
              problem.data = { properties: possibleProperties };
            }
            validationResult.problems.push(problem);
          }
        }
      }
    }

    if (isNumber(schema.maxProperties)) {
      if (node.properties.length > schema.maxProperties) {
        validationResult.problems.push({
          location: { offset: node.offset, length: node.length },
          severity: DiagnosticSeverity.Warning,
          message: `Object has more properties than limit of ${schema.maxProperties}.`,
          source: getSchemaSource(schema),
          schemaUri: getSchemaUri(schema, originalSchema),
        });
      }
    }

    if (isNumber(schema.minProperties)) {
      if (node.properties.length < schema.minProperties) {
        validationResult.problems.push({
          location: { offset: node.offset, length: node.length },
          severity: DiagnosticSeverity.Warning,
          message: `Object has fewer properties than the required number of ${schema.minProperties}`,
          source: getSchemaSource(schema),
          schemaUri: getSchemaUri(schema, originalSchema),
        });
      }
    }
  }

  //genericComparison tries to find the best matching schema using a generic comparison
  function genericComparison(
    node: ASTNode,
    maxOneMatch: boolean,
    subValidationResult: ValidationResult,
    bestMatch: {
      schema: JSONSchema;
      validationResult: ValidationResult;
      matchingSchemas: ISchemaCollector;
    },
    subSchema: JSONSchema,
    subMatchingSchemas: ISchemaCollector
  ): {
    schema: JSONSchema;
    validationResult: ValidationResult;
    matchingSchemas: ISchemaCollector;
  } {
    if (
      !maxOneMatch &&
      !subValidationResult.hasProblems() &&
      (!bestMatch.validationResult.hasProblems() || callFromAutoComplete)
    ) {
      // no errors, both are equally good matches
      bestMatch.matchingSchemas.merge(subMatchingSchemas);
      bestMatch.validationResult.propertiesMatches += subValidationResult.propertiesMatches;
      bestMatch.validationResult.propertiesValueMatches += subValidationResult.propertiesValueMatches;
    } else {
      const compareResult = subValidationResult.compareGeneric(bestMatch.validationResult);
      if (
        compareResult > 0 ||
        (compareResult === 0 &&
          maxOneMatch &&
          bestMatch.schema.type === "object" &&
          node.type !== "null" &&
          node.type !== bestMatch.schema.type)
      ) {
        // our node is the best matching so far
        bestMatch = {
          schema: subSchema,
          validationResult: subValidationResult,
          matchingSchemas: subMatchingSchemas,
        };
      } else if (compareResult === 0) {
        // there's already a best matching but we are as good
        bestMatch.matchingSchemas.merge(subMatchingSchemas);
        bestMatch.validationResult.mergeEnumValues(subValidationResult);
        bestMatch.validationResult.mergeWarningGeneric(subValidationResult, [
          ProblemType.missingRequiredPropWarning,
          ProblemType.typeMismatchWarning,
          ProblemType.constWarning,
        ]);
      }
    }
    return bestMatch;
  }
}

export function equals(one: unknown, other: unknown): boolean {
  if (one === other) {
    return true;
  }
  if (one === null || one === undefined || other === null || other === undefined) {
    return false;
  }
  if (typeof one !== typeof other) {
    return false;
  }
  if (typeof one !== "object") {
    return false;
  }
  if (Array.isArray(one) !== Array.isArray(other)) {
    return false;
  }

  let i: number, key: string;

  if (Array.isArray(one) && Array.isArray(other)) {
    if (one.length !== other.length) {
      return false;
    }
    for (i = 0; i < one.length; i++) {
      if (!equals(one[i], other[i])) {
        return false;
      }
    }
  } else {
    const oneKeys: string[] = [];

    for (key in one) {
      oneKeys.push(key);
    }
    oneKeys.sort();
    const otherKeys: string[] = [];
    for (const key in other) {
      otherKeys.push(key);
    }
    otherKeys.sort();
    if (!equals(oneKeys, otherKeys)) {
      return false;
    }
    for (let i = 0; i < oneKeys.length; i++) {
      if (!equals(one[oneKeys[i] as keyof typeof one], other[oneKeys[i] as keyof typeof other])) {
        return false;
      }
    }
  }
  return true;
}

export function isNumber(val: unknown): val is number {
  return typeof val === "number";
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function isDefined(val: unknown): val is object | string | number | boolean {
  return typeof val !== "undefined";
}

export function isBoolean(val: unknown): val is boolean {
  return typeof val === "boolean";
}

export function isString(val: unknown): val is string {
  return typeof val === "string";
}

/**
 * Check that provided value is Iterable
 * @param val the value to check
 * @returns true if val is iterable, false otherwise
 */
export function isIterable(val: unknown): boolean {
  return Symbol.iterator in Object(val);
}

export function safeCreateUnicodeRegExp(pattern: string): RegExp {
  // fall back to regular regexp if we cannot create Unicode one
  try {
    return new RegExp(pattern, "u");
  } catch (_ignore) {
    return new RegExp(pattern);
  }
}

export function convertSimple2RegExpPattern(pattern: string): string {
  return pattern.replace(/[-\\{}+?|^$.,[\]()#\s]/g, "\\$&").replace(/[*]/g, ".*");
}

/**
 * check all the schemas which is inside anyOf presented or not in matching schema.
 * @param node node
 * @param matchingSchemas all matching schema
 * @param schema scheam which is having anyOf
 * @returns true if all the schemas which inside anyOf presents in matching schema
 */
export function isAllSchemasMatched(node: ASTNode, matchingSchemas: IApplicableSchema[], schema: JSONSchema): boolean {
  let count = 0;
  for (const matchSchema of matchingSchemas) {
    if (node === matchSchema.node && matchSchema.schema !== schema) {
      schema.anyOf?.forEach((childSchema: JSONSchema) => {
        if (
          matchSchema.schema.title === childSchema.title &&
          matchSchema.schema.description === childSchema.description &&
          matchSchema.schema.properties === childSchema.properties
        ) {
          count++;
        }
      });
    }
  }
  return count === schema.anyOf?.length;
}
