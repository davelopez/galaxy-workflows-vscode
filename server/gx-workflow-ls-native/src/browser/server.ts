import { createConnection, BrowserMessageReader, BrowserMessageWriter } from "vscode-languageserver/browser";
import { NativeWorkflowLanguageService } from "../languageService";
import { GalaxyWorkflowLanguageServer } from "@gxwf/server-common/src/server";
import { GxWorkflowTestsLanguageService } from "@gxwf/workflow-tests-language-service/src/languageService";

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

const workflowLanguageService = new NativeWorkflowLanguageService();
const workflowTestsLanguageService = new GxWorkflowTestsLanguageService();
const server = new GalaxyWorkflowLanguageServer(connection, workflowLanguageService, workflowTestsLanguageService);
server.start();
