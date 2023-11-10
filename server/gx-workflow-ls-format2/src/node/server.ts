import { Connection, createConnection } from "vscode-languageserver/node";
import { container, TYPES } from "../inversify.config";
import { GalaxyWorkflowLanguageServer } from "@gxwf/server-common/src/languageTypes";

container.bind<Connection>(TYPES.Connection).toConstantValue(createConnection());

const server = container.get<GalaxyWorkflowLanguageServer>(TYPES.GalaxyWorkflowLanguageServer);
server.start();
