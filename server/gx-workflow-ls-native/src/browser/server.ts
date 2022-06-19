import { createConnection, BrowserMessageReader, BrowserMessageWriter } from "vscode-languageserver/browser";
import { NativeWorkflowLanguageService } from "../languageService";
import { GalaxyWorkflowLanguageServer } from "@gxwf/server-common/src/server";

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

const languageService = new NativeWorkflowLanguageService();
const server = new GalaxyWorkflowLanguageServer(connection, languageService);
server.start();
