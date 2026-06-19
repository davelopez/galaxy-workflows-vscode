import { NodePath, ObjectASTNode, ArrayASTNode } from "@gxwf/server-common/src/ast/types";
import { getNodeValue } from "@gxwf/server-common/src/ast/utils";
import { normalizeStepIn, normalizeStepOut, type NormalizedFormat2StepInput } from "@galaxy-tool-util/schema";
import { GxFormat2WorkflowDocument } from "../gxFormat2WorkflowDocument";

export interface SourceInPath {
  stepName: string;
}

/**
 * Expand a step's `in:` block into normalized {id, source, ...} connection
 * entries, delegating to the canonical gxformat2 shorthand expander so every
 * accepted form is covered (explicit list, map-to-string, map-to-object, and
 * map-to-list multi-source). Used to tell the native tool_state validator which
 * required params are satisfied by a connection rather than an inline value.
 */
export function getFormat2StepInputs(stepNode: ObjectASTNode): NormalizedFormat2StepInput[] {
  const inNode = stepNode.properties.find((p) => String(p.keyNode.value) === "in")?.valueNode;
  if (!inNode) return [];
  return normalizeStepIn(getNodeValue(inNode));
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

interface OrderedStep {
  /** Step label — the map key (map form) or the `label:` property (list form). */
  label: string | undefined;
  stepNode: ObjectASTNode;
}

/**
 * Return workflow steps in document order, regardless of whether `steps` is a
 * map (keyed by label) or a list (array of step objects with a `label:`).
 */
function getOrderedSteps(stepsValue: ObjectASTNode | ArrayASTNode): OrderedStep[] {
  const steps: OrderedStep[] = [];
  if (stepsValue.type === "object") {
    for (const stepProp of stepsValue.properties) {
      if (stepProp.valueNode?.type === "object") {
        steps.push({ label: String(stepProp.keyNode.value), stepNode: stepProp.valueNode as ObjectASTNode });
      }
    }
  } else {
    for (const item of stepsValue.items) {
      if (item.type !== "object") continue;
      const labelProp = (item as ObjectASTNode).properties.find((p) => String(p.keyNode.value) === "label");
      const label = labelProp?.valueNode?.type === "string" ? String(labelProp.valueNode.value) : undefined;
      steps.push({ label, stepNode: item as ObjectASTNode });
    }
  }
  return steps;
}

/**
 * Returns all source strings available at the cursor step:
 *   - Workflow-level input names (e.g. "my_input")
 *   - Outputs from steps defined BEFORE the current step in document order,
 *     in "step_label/output_name" form
 *
 * Document order is the authoritative step order in gxformat2, so iteration
 * stops at the current step to prevent forward references. `currentStep`
 * identifies that step as either its label (map form) or its array index as a
 * string (list form) — whichever `findSourceInPath` extracted from the path.
 *
 * Handles all `out:` forms: array of strings, array of objects (with `id`),
 * and object/mapping (keys are output names).
 */
export function getAvailableSources(documentContext: GxFormat2WorkflowDocument, currentStep: string): string[] {
  const sources: string[] = [];
  const nodeManager = documentContext.nodeManager;

  // Workflow-level inputs
  for (const inputNode of documentContext.getRawInputNodes()) {
    sources.push(String(inputNode.keyNode.value));
  }

  // Step outputs from steps defined before the current step (document order)
  const stepsProperty = nodeManager.getNodeFromPath("steps");
  if (
    stepsProperty?.type !== "property" ||
    (stepsProperty.valueNode?.type !== "object" && stepsProperty.valueNode?.type !== "array")
  ) {
    return sources;
  }

  const orderedSteps = getOrderedSteps(stepsProperty.valueNode as ObjectASTNode | ArrayASTNode);
  for (let i = 0; i < orderedSteps.length; i++) {
    const { label, stepNode } = orderedSteps[i];
    // Stop at the current step — no forward references. Match by label (map
    // form) or array index (list form, where currentStep is the index string).
    if (label === currentStep || String(i) === currentStep) break;
    if (!label) continue; // an unlabeled list step can't be referenced as a source

    const outProp = stepNode.properties.find((p) => String(p.keyNode.value) === "out");
    if (!outProp?.valueNode) continue;

    // Delegate every `out:` shorthand (array-of-strings, array-of-objects,
    // mapping) to the canonical expander rather than re-deriving the rules.
    for (const out of normalizeStepOut(getNodeValue(outProp.valueNode))) {
      if (out.id) sources.push(`${label}/${out.id}`);
    }
  }

  return sources;
}
