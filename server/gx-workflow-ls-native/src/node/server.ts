import { Connection, createConnection } from "vscode-languageserver/node";
import { FilesystemCacheStorage, getCacheDir } from "@galaxy-tool-util/core/node";
import { container } from "../inversify.config";
import { GalaxyWorkflowLanguageServer, TYPES } from "@gxwf/server-common/src/languageTypes";
import type { CacheStorageFactory } from "@gxwf/server-common/src/languageTypes";

container.bind<Connection>(TYPES.Connection).toConstantValue(createConnection());
container
  .bind<CacheStorageFactory>(TYPES.CacheStorageFactory)
  .toConstantValue((cacheDir) => new FilesystemCacheStorage(getCacheDir(cacheDir)));

const server = container.get<GalaxyWorkflowLanguageServer>(TYPES.GalaxyWorkflowLanguageServer);
server.start();
