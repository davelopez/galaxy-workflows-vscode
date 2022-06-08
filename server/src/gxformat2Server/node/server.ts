import { createConnection } from "vscode-languageserver/node";
import { GalaxyWorkflowLanguageServer } from "../../common/server";
import { GxFormat2WorkflowLanguageService } from "../languageService";

const connection = createConnection();

const languageService = new GxFormat2WorkflowLanguageService();
const server = new GalaxyWorkflowLanguageServer(connection, languageService);
server.start();
