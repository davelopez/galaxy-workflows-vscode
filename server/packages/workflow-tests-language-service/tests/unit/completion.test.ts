import { container } from "@gxwf/server-common/src/inversify.config";
import { CompletionList } from "@gxwf/server-common/src/languageTypes";
import { WorkflowTestsLanguageServiceContainerModule } from "@gxwf/workflow-tests-language-service/src/inversify.config";
import "reflect-metadata";
import { WorkflowTestsSchemaService } from "../../src/schema/service";
import { YAMLCompletionHelper } from "../../src/services/completion/helper";
import { TYPES } from "../../src/types";
import { createGxWorkflowTestsDocument } from "../testHelpers";

describe("Workflow Tests Completion Service", () => {
  let helper: YAMLCompletionHelper;
  beforeAll(() => {
    container.load(WorkflowTestsLanguageServiceContainerModule);
    const schemaService = container.get<WorkflowTestsSchemaService>(TYPES.WorkflowTestsSchemaService);
    helper = new YAMLCompletionHelper(schemaService);
  });

  async function getCompletions(
    contents: string,
    position: { line: number; character: number }
  ): Promise<CompletionList | null> {
    const documentContext = createGxWorkflowTestsDocument(contents);

    return await helper.doComplete(documentContext, position);
  }

  it("should suggest the `New Workflow Test` when the document is empty", async () => {
    const contents = "";
    const position = { line: 0, character: 0 };

    const completions = await getCompletions(contents, position);

    expect(completions).not.toBeNull();
    expect(completions?.items.length).toBe(1);

    expect(completions?.items[0].labelDetails?.detail).toBe("New Workflow Test");
    expect(completions?.items[0].label).toBe("- doc:");
  });

  it("should suggest the `New Workflow Test` when the document starts with dash", async () => {
    const contents = "-";
    const position = { line: 0, character: 1 };

    const completions = await getCompletions(contents, position);

    expect(completions).not.toBeNull();
    expect(completions?.items.length).toBe(1);

    expect(completions?.items[0].labelDetails?.detail).toBe("New Workflow Test");
    expect(completions?.items[0].label).toBe("- doc:");
  });

  it("should suggest the `New Workflow Test` when the position is at the beginning of a new line", async () => {
    const contents = "- doc:\n\n\n";
    const position = { line: 1, character: 0 };

    const completions = await getCompletions(contents, position);

    expect(completions).not.toBeNull();
    expect(completions?.items.length).toBe(1);

    expect(completions?.items[0].labelDetails?.detail).toBe("New Workflow Test");
    expect(completions?.items[0].label).toBe("- doc:");
  });
});
