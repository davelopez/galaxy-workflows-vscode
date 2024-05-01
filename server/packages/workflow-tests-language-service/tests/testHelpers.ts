import { TextDocument, WorkflowDataProvider } from "@gxwf/server-common/src/languageTypes";
import { YAMLDocument, getLanguageService } from "@gxwf/yaml-language-service/src";
import { GxWorkflowTestsDocument } from "../src/document";

export function toYamlDocument(contents: string): { textDoc: TextDocument; yamlDoc: YAMLDocument } {
  const textDoc = TextDocument.create("foo://bar/file.gxwf-tests.yaml", "gxwftests", 0, contents);

  const ls = getLanguageService();
  const yamlDoc = ls.parseYAMLDocument(textDoc) as YAMLDocument;
  return { textDoc, yamlDoc };
}

export function createGxWorkflowTestsDocument(
  contents: string,
  workflowDataProvider?: WorkflowDataProvider
): GxWorkflowTestsDocument {
  const { textDoc, yamlDoc } = toYamlDocument(contents);
  return new GxWorkflowTestsDocument(textDoc, yamlDoc, workflowDataProvider);
}
