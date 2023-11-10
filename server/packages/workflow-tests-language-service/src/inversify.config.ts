import { ContainerModule } from "inversify";
import { GxWorkflowTestsLanguageServiceImpl } from "./languageService";
import { TYPES, WorkflowTestsLanguageService } from "@gxwf/server-common/src/languageTypes";

export const WorkflowTestsLanguageServiceContainerModule = new ContainerModule((bind) => {
  bind<WorkflowTestsLanguageService>(TYPES.WorkflowTestsLanguageService)
    .to(GxWorkflowTestsLanguageServiceImpl)
    .inSingletonScope();
});
