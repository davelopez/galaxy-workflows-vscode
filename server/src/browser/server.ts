import { createConnection, BrowserMessageReader, BrowserMessageWriter } from "vscode-languageserver/browser";
import { GalaxyWorkflowLanguageServer } from "../server";
import { NativeWorkflowLanguageService } from "../languageService";

console.log("running server galaxy-workflow-language-server-native");

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

const languageService = new NativeWorkflowLanguageService();
const server = new GalaxyWorkflowLanguageServer(connection, languageService);
server.start();

console.log("galaxy-workflow-language-server-native STARTED");
