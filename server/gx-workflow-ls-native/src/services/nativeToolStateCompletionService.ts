import type { ToolRegistryService } from "@gxwf/server-common/src/languageTypes";
import { CompletionList, Position } from "@gxwf/server-common/src/languageTypes";
import {
  ToolStateCompletionService,
  findStateInPath,
  getCompletionTextContext,
} from "@gxwf/server-common/src/providers/toolStateCompletion";
import { NativeWorkflowDocument } from "../nativeWorkflowDocument";

/**
 * Thin wrapper around the shared `ToolStateCompletionService` for native workflows.
 * Acquires the CompletionTextContext from the shared helper and delegates.
 */
export class NativeToolStateCompletionService {
  private readonly toolStateService: ToolStateCompletionService;

  constructor(toolRegistryService: ToolRegistryService) {
    this.toolStateService = new ToolStateCompletionService(toolRegistryService);
  }

  /**
   * Returns tool-state parameter completions if the cursor is inside a
   * step's tool_state block (object-form only), otherwise returns null.
   */
  public async doCompleteAt(doc: NativeWorkflowDocument, position: Position): Promise<CompletionList | null> {
    const textDocument = doc.textDocument;
    const nodeManager = doc.nodeManager;
    const offset = textDocument.offsetAt(position);
    const node = nodeManager.getNodeFromOffset(offset);
    const nodePath = nodeManager.getPathFromNode(node);

    const stateInfo = findStateInPath(nodePath);
    if (!stateInfo) return null;

    const textCtx = getCompletionTextContext(textDocument, offset);
    const existing = nodeManager.getDeclaredPropertyNames(node);
    const items = await this.toolStateService.doComplete(
      nodeManager.root,
      nodePath,
      stateInfo,
      textCtx,
      existing
    );

    return { items, isIncomplete: false };
  }
}
