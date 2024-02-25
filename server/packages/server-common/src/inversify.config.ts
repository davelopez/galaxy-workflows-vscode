import { Container } from "inversify";
import { ConfigService, ConfigServiceImpl } from "./configService";
import { DocumentsCache, TYPES, WorkflowDataProvider } from "./languageTypes";
import { DocumentsCacheImpl } from "./models/documentsCache";
import { WorkflowDataProviderImpl } from "./providers/workflowDataProvider";

const container = new Container();
container.bind<ConfigService>(TYPES.ConfigService).to(ConfigServiceImpl).inSingletonScope();
container.bind<DocumentsCache>(TYPES.DocumentsCache).to(DocumentsCacheImpl).inSingletonScope();
container.bind<WorkflowDataProvider>(TYPES.WorkflowDataProvider).to(WorkflowDataProviderImpl).inSingletonScope();

export { container };
