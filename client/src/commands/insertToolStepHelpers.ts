import * as YAML from "yaml";

/**
 * Insert a step skeleton into a native `.ga` workflow JSON. The workflow is
 * parsed, the next available numeric step key is chosen, the step's `id` is
 * rewritten to match, and the whole document is re-serialized with 4-space
 * indentation. Callers should replace the full document text with the result.
 */
export function insertNativeStep(originalText: string, step: Record<string, unknown>): string {
  const doc = JSON.parse(originalText) as Record<string, unknown>;
  if (!doc.steps || typeof doc.steps !== "object") {
    doc.steps = {};
  }
  const steps = doc.steps as Record<string, unknown>;
  const nextIndex = nextNumericKey(steps);
  const placed = { ...step, id: nextIndex };
  steps[String(nextIndex)] = placed;
  return JSON.stringify(doc, null, 4) + "\n";
}

/**
 * Insert a step skeleton into a format2 `.gxwf.yml` workflow YAML. The
 * workflow is parsed, the step appended to `steps`, and re-serialized. Works
 * whether `steps` is originally a sequence or a mapping (converts mapping to
 * sequence on append).
 */
export function insertFormat2Step(originalText: string, step: Record<string, unknown>): string {
  const doc = YAML.parseDocument(originalText);
  const stepsNode = doc.get("steps");
  if (!stepsNode || !YAML.isCollection(stepsNode)) {
    doc.set("steps", [step]);
  } else if (YAML.isSeq(stepsNode)) {
    stepsNode.add(step);
  } else {
    // mapping form — flatten to a seq to stay canonical
    const existing = stepsNode.toJSON() as Record<string, unknown>;
    const seq = doc.createNode(Object.values(existing).concat(step));
    doc.set("steps", seq);
  }
  return doc.toString({ lineWidth: 0 });
}

function nextNumericKey(obj: Record<string, unknown>): number {
  let max = -1;
  for (const key of Object.keys(obj)) {
    const n = Number(key);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}
