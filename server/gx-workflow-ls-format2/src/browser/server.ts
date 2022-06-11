import { createConnection, BrowserMessageReader, BrowserMessageWriter } from "vscode-languageserver/browser";
import { GalaxyWorkflowLanguageServer } from "@gxwf/server-common/src/server";
import { GxFormat2WorkflowLanguageService } from "../languageService";

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

const languageService = new GxFormat2WorkflowLanguageService();
const server = new GalaxyWorkflowLanguageServer(connection, languageService);
server.start();
