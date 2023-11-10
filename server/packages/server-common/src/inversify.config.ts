import { Container } from "inversify";
import { TYPES, DocumentsCache } from "./languageTypes";
import { DocumentsCacheImpl } from "./models/documentsCache";
import { ConfigService, ConfigServiceImpl } from "./configService";

const container = new Container();
container.bind<ConfigService>(TYPES.ConfigService).to(ConfigServiceImpl).inSingletonScope();
container.bind<DocumentsCache>(TYPES.DocumentsCache).to(DocumentsCacheImpl).inSingletonScope();

export { container };
