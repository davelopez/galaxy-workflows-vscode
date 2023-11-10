import { ContainerModule } from "inversify";
import { YAMLLanguageService, getLanguageService } from "./yamlLanguageService";

export const TYPES = {
  YAMLLanguageService: Symbol.for("YAMLLanguageService"),
};

export const YAMLLanguageServiceContainerModule = new ContainerModule((bind) => {
  bind<YAMLLanguageService>(TYPES.YAMLLanguageService).toConstantValue(getLanguageService());
});
