import { Container } from "inversify";
import { ConfigService, ConfigServiceImpl } from "./configService";
import { TYPES } from "./languageTypes";
import type { DocumentsCache, ToolRegistryService, WorkflowDataProvider } from "./languageTypes";
import { DocumentsCacheImpl } from "./models/documentsCache";
import { ToolRegistryServiceImpl } from "./providers/toolRegistry";
import { WorkflowDataProviderImpl } from "./providers/workflowDataProvider";

const container = new Container();
container.bind<ConfigService>(TYPES.ConfigService).to(ConfigServiceImpl).inSingletonScope();
container.bind<DocumentsCache>(TYPES.DocumentsCache).to(DocumentsCacheImpl).inSingletonScope();
container.bind<WorkflowDataProvider>(TYPES.WorkflowDataProvider).to(WorkflowDataProviderImpl).inSingletonScope();
container.bind<ToolRegistryService>(TYPES.ToolRegistryService).to(ToolRegistryServiceImpl).inSingletonScope();

export { container };
