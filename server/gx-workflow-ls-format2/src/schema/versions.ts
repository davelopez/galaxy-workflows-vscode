import schema_common from "@schemas/gxformat2/common/common.yaml";
import schema_common_metaschema_base from "@schemas/gxformat2/common/metaschema/metaschema_base.yaml";
import schema_v19_09_process from "@schemas/gxformat2/v19_09/process.yaml";
import schema_v19_09_workflows from "@schemas/gxformat2/v19_09/workflows.yaml";
import { SchemaDocument } from "./definitions";

/**
 * All gxformat2 version 19_09 schema documents.
 *
 * These documents are raw yaml documents loaded by webpack.
 *  */
export const SCHEMA_DOCS_v19_09_MAP = new Map<string, SchemaDocument>(
  [
    schema_common_metaschema_base as SchemaDocument,
    schema_v19_09_process as SchemaDocument,
    schema_common as SchemaDocument,
    schema_v19_09_workflows as SchemaDocument,
  ].map((schemaDoc) => [schemaDoc.$base, schemaDoc])
);
