import { GalaxyWorkflowLanguageServer } from "../languageTypes";

export abstract class Provider {
  constructor(public server: GalaxyWorkflowLanguageServer) {}
}
