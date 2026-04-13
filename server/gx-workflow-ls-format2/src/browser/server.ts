import "reflect-metadata";
import {
  createConnection,
  BrowserMessageReader,
  BrowserMessageWriter,
  Connection,
} from "vscode-languageserver/browser";
import { IndexedDBCacheStorage } from "@galaxy-tool-util/core";
import { TYPES, container } from "../inversify.config";
import { GalaxyWorkflowLanguageServer } from "@gxwf/server-common/src/languageTypes";
import type { CacheStorageFactory } from "@gxwf/server-common/src/languageTypes";

function createBrowserConnection(): Connection {
  const messageReader = new BrowserMessageReader(self);
  const messageWriter = new BrowserMessageWriter(self);

  const connection = createConnection(messageReader, messageWriter);
  return connection;
}

container.bind<Connection>(TYPES.Connection).toConstantValue(createBrowserConnection());
container.bind<CacheStorageFactory>(TYPES.CacheStorageFactory).toConstantValue(() => new IndexedDBCacheStorage());

const server = container.get<GalaxyWorkflowLanguageServer>(TYPES.GalaxyWorkflowLanguageServer);
server.start();
