export namespace CommandIds {
  export const PREVIEW_CLEAN_WORKFLOW = getExtensionCommand("previewCleanWorkflow");
  export const COMPARE_CLEAN_WORKFLOW = getExtensionCommand("compareCleanWorkflow");
}

function getExtensionCommand(command: string) {
  return `galaxy-workflows.${command}`;
}
