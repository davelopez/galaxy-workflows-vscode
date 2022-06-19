import { createConnection } from "vscode-languageserver/node";
import { GalaxyWorkflowLanguageServer } from "@gxwf/server-common/src/server";
import { NativeWorkflowLanguageService } from "../languageService";

const connection = createConnection();

const languageService = new NativeWorkflowLanguageService();
const server = new GalaxyWorkflowLanguageServer(connection, languageService);
server.start();
