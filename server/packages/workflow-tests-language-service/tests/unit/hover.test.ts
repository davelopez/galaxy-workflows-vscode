import { container } from "@gxwf/server-common/src/inversify.config";
import { Hover, MarkupContent, WorkflowDataProvider } from "@gxwf/server-common/src/languageTypes";
import { FAKE_WORKFLOW_DATA_PROVIDER, parseTemplate } from "@gxwf/server-common/tests/testHelpers";
import { WorkflowTestsLanguageServiceContainerModule } from "@gxwf/workflow-tests-language-service/src/inversify.config";
import { WorkflowTestsHoverService } from "@gxwf/workflow-tests-language-service/src/services/hover";
import { TYPES } from "@gxwf/workflow-tests-language-service/src/types";
import "reflect-metadata";
import { createGxWorkflowTestsDocument } from "../testHelpers";

describe("Workflow Tests Hover Service", () => {
  let service: WorkflowTestsHoverService;
  beforeAll(() => {
    container.load(WorkflowTestsLanguageServiceContainerModule);
    service = container.get<WorkflowTestsHoverService>(TYPES.WorkflowTestsHoverService);
  });

  async function getHover(
    contents: string,
    position: { line: number; character: number },
    workflowDataProvider: WorkflowDataProvider = FAKE_WORKFLOW_DATA_PROVIDER
  ): Promise<Hover | null> {
    const documentContext = createGxWorkflowTestsDocument(contents, workflowDataProvider);

    return await service.doHover(documentContext, position);
  }

  it("should return the documentation of the `doc` property when hovering over it", async () => {
    const template = `
- do$c: The docs
  `;
    const { contents, position } = parseTemplate(template);
    const hover = await getHover(contents, position);

    expect(hover).not.toBeNull();

    expectHoverToContainContents(hover!, "Doc");
    expectHoverToContainContents(hover!, "Describes the purpose of the test");
  });

  it("should return the documentation of the `job` property when hovering over it", async () => {
    const template = `
- doc: The docs
  jo$b:
  `;
    const { contents, position } = parseTemplate(template);
    const hover = await getHover(contents, position);

    expect(hover).not.toBeNull();

    expectHoverToContainContents(hover!, "Job");
    expectHoverToContainContents(hover!, "Defines job to execute");
  });

  it("should return the documentation of the `outputs` property when hovering over it", async () => {
    const template = `
- doc: The docs
  outp$uts:
  `;
    const { contents, position } = parseTemplate(template);
    const hover = await getHover(contents, position);

    expect(hover).not.toBeNull();

    expectHoverToContainContents(hover!, "Outputs");
    expectHoverToContainContents(hover!, "Defines assertions about outputs");
  });

  describe("Workflow Inputs/Outputs Hover", () => {
    it.each<[string, string[]]>([
      [
        `
- job:
    My fake$ dataset:
  `,
        ["My fake dataset", "This is a simple dataset", "Type: data"],
      ],
      [
        `
- job:
    'Input$ dataset: fake':
  `,
        ["Input dataset: fake", "This is a simple dataset with a colon in the name", "Type: File"],
      ],
      [
        `
- job:
    My fake$ collection:
  `,
        ["My fake collection", "This is a collection", "Type: collection"],
      ],
      [
        `
- outputs:
    My out$put:
  `,
        ["My output", "1234-5678-91011-1213"],
      ],
      [
        `
- outputs:
    My second out$put:
  `,
        ["My second output", "1234-5678-91011-1214"],
      ],
      [
        `
- outputs:
    'My third out$put: with colon':
  `,
        ["My third output: with colon", "1234-5678-91011-1215"],
      ],
    ])(
      "should return the documentation of the workflow inputs when hovering over them",
      async (template: string, expectedHoverContents: string[]) => {
        const { contents, position } = parseTemplate(template);
        const hover = await getHover(contents, position);

        expect(hover).not.toBeNull();

        for (const expectedContent of expectedHoverContents) {
          expectHoverToContainContents(hover!, expectedContent);
        }
      }
    );
  });
});

function expectHoverToContainContents(hover: Hover, expectedContents: string): void {
  expect(hover.contents).toBeDefined();
  const contents = hover.contents as MarkupContent;
  expect(contents.value).toContain(expectedContents);
}
