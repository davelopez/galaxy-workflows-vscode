import "reflect-metadata";
import { RenderDiagramService } from "../../src/services/renderDiagramService";
import type { DiagramFormat, GalaxyWorkflowLanguageServer } from "../../src/languageTypes";

type RenderImpl = (text: string, format: DiagramFormat, options?: Record<string, unknown>) => Promise<string>;

function registerAndGetHandler(renderImpl: RenderImpl, captureLanguageId?: (id: string) => void) {
  let handler!: (params: unknown) => Promise<unknown>;
  const server = {
    connection: {
      onRequest: (_id: string, fn: (params: unknown) => Promise<unknown>) => {
        handler = fn;
      },
    },
    getLanguageServiceById: (id: string) => {
      captureLanguageId?.(id);
      return { renderDiagram: renderImpl };
    },
  } as unknown as GalaxyWorkflowLanguageServer;
  RenderDiagramService.register(server);
  return handler;
}

const MINIMAL_NATIVE_JSON = JSON.stringify({
  a_galaxy_workflow: "true",
  format_version: "0.1",
  name: "Test",
  steps: {},
});
const MINIMAL_FORMAT2_YAML = "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps: {}\n";

describe("RenderDiagramService", () => {
  it("returns rendered contents on success", async () => {
    const handler = registerAndGetHandler(async () => "graph LR\nA-->B");
    const result = (await handler({ contents: MINIMAL_NATIVE_JSON, format: "mermaid" })) as {
      contents: string;
      error?: string;
    };
    expect(result.contents).toBe("graph LR\nA-->B");
    expect(result.error).toBeUndefined();
  });

  it("returns error field when renderDiagram throws", async () => {
    const handler = registerAndGetHandler(async () => {
      throw new Error("rendering failed");
    });
    const result = (await handler({ contents: MINIMAL_NATIVE_JSON, format: "mermaid" })) as {
      contents: string;
      error?: string;
    };
    expect(result.contents).toBe("");
    expect(result.error).toContain("rendering failed");
  });

  it("routes native JSON to galaxyworkflow language service", async () => {
    let capturedLanguageId = "";
    const handler = registerAndGetHandler(
      async () => "graph LR",
      (id) => {
        capturedLanguageId = id;
      }
    );
    await handler({ contents: MINIMAL_NATIVE_JSON, format: "mermaid" });
    expect(capturedLanguageId).toBe("galaxyworkflow");
  });

  it("routes format2 YAML to gxformat2 language service", async () => {
    let capturedLanguageId = "";
    const handler = registerAndGetHandler(
      async () => "graph LR",
      (id) => {
        capturedLanguageId = id;
      }
    );
    await handler({ contents: MINIMAL_FORMAT2_YAML, format: "mermaid" });
    expect(capturedLanguageId).toBe("gxformat2");
  });

  it("forwards format and options to the language service", async () => {
    let capturedFormat: DiagramFormat | undefined;
    let capturedOptions: Record<string, unknown> | undefined;
    const handler = registerAndGetHandler(async (_text, format, options) => {
      capturedFormat = format;
      capturedOptions = options;
      return "graph LR";
    });
    await handler({ contents: MINIMAL_NATIVE_JSON, format: "mermaid", options: { comments: true } });
    expect(capturedFormat).toBe("mermaid");
    expect(capturedOptions).toEqual({ comments: true });
  });

  it("registers under RENDER_WORKFLOW_DIAGRAM identifier", () => {
    let registeredId = "";
    const server = {
      connection: {
        onRequest: (id: string) => {
          registeredId = id;
        },
      },
      getLanguageServiceById: () => ({ renderDiagram: async () => "" }),
    } as unknown as GalaxyWorkflowLanguageServer;
    RenderDiagramService.register(server);
    expect(registeredId).toBe("galaxy-workflows-ls.renderWorkflowDiagram");
  });
});
