import { GalaxyWorkflowLanguageServer } from "../languageTypes";

/**
 * Base class for all server event handlers.
 *
 * Used to register event handlers for the language server.
 */
export abstract class ServerEventHandler {
  constructor(public server: GalaxyWorkflowLanguageServer) {}
}
