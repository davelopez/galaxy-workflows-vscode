import { container } from "@gxwf/server-common/src/inversify.config";
import { GalaxyWorkflowLanguageServer, TYPES, WorkflowLanguageService } from "@gxwf/server-common/src/languageTypes";
import { GalaxyWorkflowLanguageServerImpl } from "@gxwf/server-common/src/server";
import { WorkflowTestsLanguageServiceContainerModule } from "@gxwf/workflow-tests-language-service/src/inversify.config";
import { YAMLLanguageServiceContainerModule } from "@gxwf/yaml-language-service/src/inversify.config";
import { NativeWorkflowLanguageServiceImpl } from "./languageService";
import { NativeWorkflowSymbolsProvider } from "./services/symbols";

container.load(YAMLLanguageServiceContainerModule);
container.load(WorkflowTestsLanguageServiceContainerModule);

container
  .bind<WorkflowLanguageService>(TYPES.WorkflowLanguageService)
  .to(NativeWorkflowLanguageServiceImpl)
  .inSingletonScope();

container
  .bind<GalaxyWorkflowLanguageServer>(TYPES.GalaxyWorkflowLanguageServer)
  .to(GalaxyWorkflowLanguageServerImpl)
  .inSingletonScope();

container
  .bind<NativeWorkflowSymbolsProvider>(TYPES.SymbolsProvider)
  .to(NativeWorkflowSymbolsProvider)
  .inSingletonScope();

export { container };
