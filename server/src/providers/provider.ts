import { Connection } from "vscode-languageserver";
import { WorkflowLanguageService } from "../languageTypes";
import { WorkflowDocuments } from "../models/workflowDocuments";
import { GalaxyWorkflowLanguageServer } from "../server";

export abstract class Provider {
  protected connection: Connection;
  protected workflowDocuments: WorkflowDocuments;
  protected languageService: WorkflowLanguageService;
  protected server: GalaxyWorkflowLanguageServer;

  constructor(server: GalaxyWorkflowLanguageServer) {
    this.server = server;
    this.workflowDocuments = server.workflowDocuments;
    this.languageService = server.languageService;
    this.connection = server.connection;
  }
}
