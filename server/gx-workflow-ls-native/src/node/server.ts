import { createConnection } from "vscode-languageserver/node";
import { GalaxyWorkflowLanguageServer } from "@gxwf/server-common/src/server";
import { NativeWorkflowLanguageService } from "../languageService";
import { GxWorkflowTestsLanguageService } from "@gxwf/workflow-tests-language-service/src/languageService";

const connection = createConnection();

const languageService = new NativeWorkflowLanguageService();
const workflowTestsLanguageService = new GxWorkflowTestsLanguageService();
const server = new GalaxyWorkflowLanguageServer(connection, languageService, workflowTestsLanguageService);
server.start();
