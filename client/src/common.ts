import { LanguageClientOptions } from "vscode-languageclient";
import { Constants } from "./constants";

export function buildLanguageClientOptions() {
  const documentSelector = [{ language: Constants.NATIVE_WORKFLOW_LANGUAGE_ID }];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {},
    initializationOptions: {},
  };
  return clientOptions;
}
