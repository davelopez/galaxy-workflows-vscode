import schema_v19_09_workflows from "../../../../workflow-languages/schemas/gxformat2/v19_09/workflows.yaml";
import schema_common_metaschema_base from "../../../../workflow-languages/schemas/gxformat2/common/metaschema/metaschema_base.yaml";
import schema_v19_09_process from "../../../../workflow-languages/schemas/gxformat2/v19_09/process.yaml";
import schema_common from "../../../../workflow-languages/schemas/gxformat2/common/common.yaml";

/**
 * All gxformat2 version 19_09 schema documents.
 *
 * These documents are raw yaml documents loaded by webpack.
 *  */
export const SCHEMA_DOCS_v19_09 = [
  schema_common_metaschema_base,
  schema_v19_09_process,
  schema_common,
  schema_v19_09_workflows,
];
