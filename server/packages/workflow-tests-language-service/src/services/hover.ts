import { ASTNodeManager } from "@gxwf/server-common/src/ast/nodeManager";
import { Hover, Position, TextDocument } from "@gxwf/server-common/src/languageTypes";
import { injectable } from "inversify";

export interface WorkflowTestsHoverService {
  doHover(document: TextDocument, position: Position, nodeManager: ASTNodeManager): Promise<Hover | null>;
}

@injectable()
export class WorkflowTestsHoverServiceImpl implements WorkflowTestsHoverService {
  public async doHover(document: TextDocument, position: Position, nodeManager: ASTNodeManager): Promise<Hover | null> {
    return null;
  }
}
