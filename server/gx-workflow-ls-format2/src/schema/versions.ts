//TODO: remove this reference when https://github.com/sumwatshade/jest-transform-yaml/pull/20 is merged and upgrade to jest 28
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />

import schema_v19_09_workflows from "@schemas/gxformat2/v19_09/workflows.yaml";
import schema_common_metaschema_base from "@schemas/gxformat2/common/metaschema/metaschema_base.yaml";
import schema_v19_09_process from "@schemas/gxformat2/v19_09/process.yaml";
import schema_common from "@schemas/gxformat2/common/common.yaml";
import { SchemaDocument } from "./definitions";

/**
 * All gxformat2 version 19_09 schema documents.
 *
 * These documents are raw yaml documents loaded by webpack.
 *  */
export const SCHEMA_DOCS_v19_09_MAP = new Map<string, SchemaDocument>([
  [schema_common_metaschema_base.$base, schema_common_metaschema_base],
  [schema_v19_09_process.$base, schema_v19_09_process],
  [schema_common.$base, schema_common],
  [schema_v19_09_workflows.$base, schema_v19_09_workflows],
]);
