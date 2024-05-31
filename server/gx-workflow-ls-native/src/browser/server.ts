import {
  createConnection,
  BrowserMessageReader,
  BrowserMessageWriter,
  Connection,
} from "vscode-languageserver/browser";
import { container } from "../inversify.config";
import { GalaxyWorkflowLanguageServer, TYPES } from "@gxwf/server-common/src/languageTypes";

function createBrowserConnection(): Connection {
  const messageReader = new BrowserMessageReader(self);
  const messageWriter = new BrowserMessageWriter(self);

  const connection = createConnection(messageReader, messageWriter);
  return connection;
}

container.bind<Connection>(TYPES.Connection).toConstantValue(createBrowserConnection());

const server = container.get<GalaxyWorkflowLanguageServer>(TYPES.GalaxyWorkflowLanguageServer);
server.start();
