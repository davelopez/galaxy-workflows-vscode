import { container } from "@gxwf/server-common/src/inversify.config";
import {
  TYPES as COMMON_TYPES,
  GalaxyWorkflowLanguageServer,
  SymbolsProvider,
  WorkflowLanguageService,
} from "@gxwf/server-common/src/languageTypes";
import { GalaxyWorkflowLanguageServerImpl } from "@gxwf/server-common/src/server";
import { WorkflowTestsLanguageServiceContainerModule } from "@gxwf/workflow-tests-language-service/src/inversify.config";
import { YAMLLanguageServiceContainerModule } from "@gxwf/yaml-language-service/src/inversify.config";
import { GxFormat2WorkflowLanguageServiceImpl } from "./languageService";
import { GxFormat2WorkflowSymbolsProvider } from "./services/symbols";

export const TYPES = {
  ...COMMON_TYPES,
};

container.load(YAMLLanguageServiceContainerModule);
container.load(WorkflowTestsLanguageServiceContainerModule);

container
  .bind<WorkflowLanguageService>(TYPES.WorkflowLanguageService)
  .to(GxFormat2WorkflowLanguageServiceImpl)
  .inSingletonScope();

container
  .bind<GalaxyWorkflowLanguageServer>(TYPES.GalaxyWorkflowLanguageServer)
  .to(GalaxyWorkflowLanguageServerImpl)
  .inSingletonScope();

container.bind<SymbolsProvider>(TYPES.SymbolsProvider).to(GxFormat2WorkflowSymbolsProvider).inSingletonScope();

export { container };
