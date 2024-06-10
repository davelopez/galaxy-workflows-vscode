import {
  TYPES as COMMON_TYPES,
  SymbolsProvider,
  WorkflowTestsLanguageService,
} from "@gxwf/server-common/src/languageTypes";
import { ContainerModule } from "inversify";
import { GxWorkflowTestsLanguageServiceImpl } from "./languageService";
import { JSONSchemaService, JSONSchemaServiceImpl } from "./schema/adapter";
import { WorkflowTestsSchemaProvider, WorkflowTestsSchemaProviderImpl } from "./schema/provider";
import { WorkflowTestsSchemaService, WorkflowTestsSchemaServiceImpl } from "./schema/service";
import { WorkflowTestsCompletionService, WorkflowTestsCompletionServiceImpl } from "./services/completion";
import { WorkflowTestsHoverService, WorkflowTestsHoverServiceImpl } from "./services/hover";
import { WorkflowTestsSymbolsProvider } from "./services/symbols";
import { WorkflowTestsValidationService, WorkflowTestsValidationServiceImpl } from "./services/validation";
import { TYPES } from "./types";

export const WorkflowTestsLanguageServiceContainerModule = new ContainerModule((bind) => {
  bind<WorkflowTestsSchemaProvider>(TYPES.WorkflowTestsSchemaProvider)
    .to(WorkflowTestsSchemaProviderImpl)
    .inSingletonScope();

  bind<JSONSchemaService>(TYPES.JSONSchemaService).to(JSONSchemaServiceImpl).inSingletonScope();

  bind<WorkflowTestsSchemaService>(TYPES.WorkflowTestsSchemaService)
    .to(WorkflowTestsSchemaServiceImpl)
    .inSingletonScope();

  bind<WorkflowTestsHoverService>(TYPES.WorkflowTestsHoverService).to(WorkflowTestsHoverServiceImpl).inSingletonScope();

  bind<WorkflowTestsCompletionService>(TYPES.WorkflowTestsCompletionService)
    .to(WorkflowTestsCompletionServiceImpl)
    .inSingletonScope();

  bind<WorkflowTestsValidationService>(TYPES.WorkflowTestsValidationService)
    .to(WorkflowTestsValidationServiceImpl)
    .inSingletonScope();

  bind<WorkflowTestsLanguageService>(COMMON_TYPES.WorkflowTestsLanguageService)
    .to(GxWorkflowTestsLanguageServiceImpl)
    .inSingletonScope();

  bind<SymbolsProvider>(TYPES.WorkflowTestsSymbolsProvider).to(WorkflowTestsSymbolsProvider).inSingletonScope();
});
