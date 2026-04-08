import { TYPES as COMMON_TYPES } from "@gxwf/server-common/src/languageTypes";
import type { SymbolsProvider, WorkflowTestsLanguageService } from "@gxwf/server-common/src/languageTypes";
import { ContainerModule } from "inversify";
import { GxWorkflowTestsLanguageServiceImpl } from "./languageService";
import { JSONSchemaServiceImpl } from "./schema/adapter";
import type { JSONSchemaService } from "./schema/adapter";
import { WorkflowTestsSchemaProviderImpl } from "./schema/provider";
import type { WorkflowTestsSchemaProvider } from "./schema/provider";
import { WorkflowTestsSchemaServiceImpl } from "./schema/service";
import type { WorkflowTestsSchemaService } from "./schema/service";
import { WorkflowTestsCompletionServiceImpl } from "./services/completion";
import type { WorkflowTestsCompletionService } from "./services/completion";
import { WorkflowTestsHoverServiceImpl } from "./services/hover";
import type { WorkflowTestsHoverService } from "./services/hover";
import { WorkflowTestsSymbolsProvider } from "./services/symbols";
import { WorkflowTestsValidationServiceImpl } from "./services/validation";
import type { WorkflowTestsValidationService } from "./services/validation";
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
