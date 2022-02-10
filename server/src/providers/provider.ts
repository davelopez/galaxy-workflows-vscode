import { ServerContext } from "../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../server";

export abstract class Provider extends ServerContext {
  constructor(server: GalaxyWorkflowLanguageServer) {
    super(server);
  }
}
