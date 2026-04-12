import { NodePath, ObjectASTNode, ArrayASTNode } from "@gxwf/server-common/src/ast/types";
import { GxFormat2WorkflowDocument } from "../gxFormat2WorkflowDocument";

export interface SourceInPath {
  stepName: string;
}

/**
 * Detects whether `path` ends at a `source:` value inside a step's `in:` block.
 * Handles both the explicit list form and the map shorthand form:
 *   - Explicit: ["steps", stepName, "in", index, "source"]
 *   - Shorthand: ["steps", stepName, "in", inputName]  (value IS the source)
 */
export function findSourceInPath(path: NodePath): SourceInPath | undefined {
  const n = path.length;
  // Explicit form: steps / stepName / in / <index> / source
  if (
    n >= 5 &&
    path[n - 1] === "source" &&
    typeof path[n - 2] === "number" &&
    path[n - 3] === "in" &&
    path[n - 5] === "steps"
  ) {
    return { stepName: String(path[n - 4]) };
  }
  // Map shorthand: steps / stepName / in / inputName
  if (
    n >= 4 &&
    typeof path[n - 1] === "string" &&
    path[n - 1] !== "in" &&
    path[n - 2] === "in" &&
    path[n - 4] === "steps"
  ) {
    return { stepName: String(path[n - 3]) };
  }
  return undefined;
}

/**
 * Returns all source strings available at the cursor step:
 *   - Workflow-level input names (e.g. "my_input")
 *   - Outputs from steps defined BEFORE `currentStepName` in YAML order,
 *     in "step_label/output_name" form
 *
 * YAML property order is the authoritative step order in gxformat2, so
 * iteration stops at the current step to prevent forward references.
 *
 * Handles all `out:` forms: array of strings, array of objects (with `id`),
 * and object/mapping (keys are output names).
 */
export function getAvailableSources(documentContext: GxFormat2WorkflowDocument, currentStepName: string): string[] {
  const sources: string[] = [];
  const nodeManager = documentContext.nodeManager;

  // Workflow-level inputs
  for (const inputNode of documentContext.getRawInputNodes()) {
    sources.push(String(inputNode.keyNode.value));
  }

  // Step outputs from steps defined before the current step (YAML order)
  const stepsProperty = nodeManager.getNodeFromPath("steps");
  if (stepsProperty?.type !== "property" || stepsProperty.valueNode?.type !== "object") {
    return sources;
  }

  for (const stepProp of (stepsProperty.valueNode as ObjectASTNode).properties) {
    const stepLabel = String(stepProp.keyNode.value);
    if (stepLabel === currentStepName) break; // stop at current step — no forward references

    const stepNode = stepProp.valueNode;
    if (!stepNode || stepNode.type !== "object") continue;

    const outProp = stepNode.properties.find((p) => String(p.keyNode.value) === "out");
    if (!outProp?.valueNode) continue;

    const outNode = outProp.valueNode;
    if (outNode.type === "array") {
      for (const item of (outNode as ArrayASTNode).items) {
        if (item.type === "string") {
          sources.push(`${stepLabel}/${String(item.value)}`);
        } else if (item.type === "object") {
          // Array-of-objects form: out: [{id: "out1", hide: true}]
          const idProp = (item as ObjectASTNode).properties.find(
            (p) => String(p.keyNode.value) === "id"
          );
          if (idProp?.valueNode?.type === "string") {
            sources.push(`${stepLabel}/${String(idProp.valueNode.value)}`);
          }
        }
      }
    } else if (outNode.type === "object") {
      // Object/mapping form: out: {out_file1: {hide: true}, out_file2: {}}
      for (const prop of (outNode as ObjectASTNode).properties) {
        sources.push(`${stepLabel}/${String(prop.keyNode.value)}`);
      }
    }
  }

  return sources;
}
