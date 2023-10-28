import { createConnection } from "vscode-languageserver/node";
import { GalaxyWorkflowLanguageServer } from "@gxwf/server-common/src/server";
import { GxFormat2WorkflowLanguageService } from "../languageService";
import { GxWorkflowTestsLanguageService } from "@gxwf/workflow-tests-language-service/src/languageService";

const connection = createConnection();

const workflowLanguageService = new GxFormat2WorkflowLanguageService();
const workflowTestsLanguageService = new GxWorkflowTestsLanguageService();
const server = new GalaxyWorkflowLanguageServer(connection, workflowLanguageService, workflowTestsLanguageService);
server.start();
