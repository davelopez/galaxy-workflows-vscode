import { ASTNode } from "@gxwf/server-common/src/ast/types";
import { TextDocument } from "@gxwf/server-common/src/languageTypes";
import { getLanguageService, YAMLDocument } from "@gxwf/yaml-language-service/src";
import { GxFormat2WorkflowDocument } from "../src/gxFormat2WorkflowDocument";

export function toYamlDocument(contents: string): { textDoc: TextDocument; yamlDoc: YAMLDocument } {
  const textDoc = TextDocument.create("foo://bar/file.gxwf.yaml", "gxformat2", 0, contents);

  const ls = getLanguageService();
  const yamlDoc = ls.parseYAMLDocument(textDoc) as YAMLDocument;
  return { textDoc, yamlDoc };
}

export function getYamlDocumentRoot(contents: string): ASTNode {
  const { yamlDoc } = toYamlDocument(contents);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return yamlDoc.root!;
}

export function createFormat2WorkflowDocument(contents: string): GxFormat2WorkflowDocument {
  const { textDoc, yamlDoc } = toYamlDocument(contents);
  return new GxFormat2WorkflowDocument(textDoc, yamlDoc);
}
