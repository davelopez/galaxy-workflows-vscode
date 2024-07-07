import { Container } from "inversify";
import { ConfigService, ConfigServiceImpl } from "./configService";
import { DocumentsCache, TYPES, ToolshedService, WorkflowDataProvider } from "./languageTypes";
import { DocumentsCacheImpl } from "./models/documentsCache";
import { WorkflowDataProviderImpl } from "./providers/workflowDataProvider";
import { ToolshedServiceImpl } from "./services/toolShed";

const container = new Container();
container.bind<ConfigService>(TYPES.ConfigService).to(ConfigServiceImpl).inSingletonScope();
container.bind<DocumentsCache>(TYPES.DocumentsCache).to(DocumentsCacheImpl).inSingletonScope();
container.bind<WorkflowDataProvider>(TYPES.WorkflowDataProvider).to(WorkflowDataProviderImpl).inSingletonScope();
container.bind<ToolshedService>(TYPES.ToolshedService).to(ToolshedServiceImpl).inSingletonScope();

export { container };
