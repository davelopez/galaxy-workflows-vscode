import { ContainerModule } from "inversify";
import { GxWorkflowTestsLanguageServiceImpl } from "./languageService";
import { TYPES as COMMON_TYPES, WorkflowTestsLanguageService } from "@gxwf/server-common/src/languageTypes";
import { WorkflowTestsHoverService, WorkflowTestsHoverServiceImpl } from "./services/hover";
import { TYPES } from "./types";
import { WorkflowTestsSchemaProvider, WorkflowTestsSchemaProviderImpl } from "./schema/provider";
import { JSONSchemaService, JSONSchemaServiceImpl } from "./schema/adapter";
import { WorkflowTestsSchemaService, WorkflowTestsSchemaServiceImpl } from "./schema/service";
import { WorkflowTestsValidationService, WorkflowTestsValidationServiceImpl } from "./services/validation";

export const WorkflowTestsLanguageServiceContainerModule = new ContainerModule((bind) => {
  bind<WorkflowTestsSchemaProvider>(TYPES.WorkflowTestsSchemaProvider)
    .to(WorkflowTestsSchemaProviderImpl)
    .inSingletonScope();
  bind<JSONSchemaService>(TYPES.JSONSchemaService).to(JSONSchemaServiceImpl).inSingletonScope();
  bind<WorkflowTestsSchemaService>(TYPES.WorkflowTestsSchemaService)
    .to(WorkflowTestsSchemaServiceImpl)
    .inSingletonScope();
  bind<WorkflowTestsHoverService>(TYPES.WorkflowTestsHoverService).to(WorkflowTestsHoverServiceImpl).inSingletonScope();
  bind<WorkflowTestsValidationService>(TYPES.WorkflowTestsValidationService)
    .to(WorkflowTestsValidationServiceImpl)
    .inSingletonScope();
  bind<WorkflowTestsLanguageService>(COMMON_TYPES.WorkflowTestsLanguageService)
    .to(GxWorkflowTestsLanguageServiceImpl)
    .inSingletonScope();
});
