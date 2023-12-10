import { ContainerModule } from "inversify";
import { GxWorkflowTestsLanguageServiceImpl } from "./languageService";
import { TYPES as COMMON_TYPES, WorkflowTestsLanguageService } from "@gxwf/server-common/src/languageTypes";
import { WorkflowTestsHoverService, WorkflowTestsHoverServiceImpl } from "./services/hover";
import { TYPES } from "./types";
import { WorkflowTestsSchemaProvider, WorkflowTestsSchemaProviderImpl } from "./schema/provider";

export const WorkflowTestsLanguageServiceContainerModule = new ContainerModule((bind) => {
  bind<WorkflowTestsSchemaProvider>(TYPES.WorkflowTestsSchemaProvider)
    .to(WorkflowTestsSchemaProviderImpl)
    .inSingletonScope();
  bind<WorkflowTestsHoverService>(TYPES.WorkflowTestsHoverService).to(WorkflowTestsHoverServiceImpl).inSingletonScope();
  bind<WorkflowTestsLanguageService>(COMMON_TYPES.WorkflowTestsLanguageService)
    .to(GxWorkflowTestsLanguageServiceImpl)
    .inSingletonScope();
});
