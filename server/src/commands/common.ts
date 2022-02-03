import { ServerContext } from "../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../server";

export abstract class CustomCommand extends ServerContext {
  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
  }
}
