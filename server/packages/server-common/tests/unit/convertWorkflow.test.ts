import "reflect-metadata";
import { ConvertWorkflowService } from "../../src/services/convertWorkflow";
import type { GalaxyWorkflowLanguageServer } from "../../src/languageTypes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Registers ConvertWorkflowService and returns the captured request handler. */
function registerAndGetHandler(
  convertImpl: (text: string, targetFormat: "format2" | "native") => Promise<string>
): (params: unknown) => Promise<unknown> {
  let handler!: (params: unknown) => Promise<unknown>;

  const server = {
    connection: {
      onRequest: (_id: string, fn: (params: unknown) => Promise<unknown>) => {
        handler = fn;
      },
    },
    getLanguageServiceById: () => ({
      convertWorkflowText: convertImpl,
    }),
  } as unknown as GalaxyWorkflowLanguageServer;

  ConvertWorkflowService.register(server);
  return handler;
}

const MINIMAL_NATIVE_JSON = JSON.stringify({
  a_galaxy_workflow: "true",
  format_version: "0.1",
  name: "Test",
  steps: {},
});

const MINIMAL_FORMAT2_YAML = "class: GalaxyWorkflow\ninputs: {}\noutputs: {}\nsteps: {}\n";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ConvertWorkflowService", () => {
  describe("language detection", () => {
    it("routes native JSON to galaxyworkflow language service", async () => {
      const seen: string[] = [];
      let capturedLanguageId = "";

      const server = {
        connection: { onRequest: (_id: string, fn: unknown) => { (server as Record<string, unknown>)._handler = fn; } },
        getLanguageServiceById: (id: string) => {
          capturedLanguageId = id;
          return { convertWorkflowText: async () => "converted" };
        },
      } as unknown as GalaxyWorkflowLanguageServer;

      ConvertWorkflowService.register(server);
      const handler = (server as unknown as Record<string, (p: unknown) => Promise<unknown>>)._handler;
      await handler({ contents: MINIMAL_NATIVE_JSON, targetFormat: "format2" });

      expect(capturedLanguageId).toBe("galaxyworkflow");
      void seen;
    });

    it("routes format2 YAML to gxformat2 language service", async () => {
      let capturedLanguageId = "";

      const server = {
        connection: { onRequest: (_id: string, fn: unknown) => { (server as Record<string, unknown>)._handler = fn; } },
        getLanguageServiceById: (id: string) => {
          capturedLanguageId = id;
          return { convertWorkflowText: async () => "converted" };
        },
      } as unknown as GalaxyWorkflowLanguageServer;

      ConvertWorkflowService.register(server);
      const handler = (server as unknown as Record<string, (p: unknown) => Promise<unknown>>)._handler;
      await handler({ contents: MINIMAL_FORMAT2_YAML, targetFormat: "native" });

      expect(capturedLanguageId).toBe("gxformat2");
    });
  });

  describe("result passing", () => {
    it("returns converted contents on success", async () => {
      const handler = registerAndGetHandler(async () => "converted output");
      const result = await handler({ contents: MINIMAL_FORMAT2_YAML, targetFormat: "native" }) as {
        contents: string;
        error?: string;
      };
      expect(result.contents).toBe("converted output");
      expect(result.error).toBeUndefined();
    });

    it("returns error field when convertWorkflowText throws", async () => {
      const handler = registerAndGetHandler(async () => {
        throw new Error("unsupported conversion");
      });
      const result = await handler({ contents: MINIMAL_FORMAT2_YAML, targetFormat: "native" }) as {
        contents: string;
        error?: string;
      };
      expect(result.contents).toBe("");
      expect(result.error).toContain("unsupported conversion");
    });
  });

  describe("clean flag", () => {
    it("cleans before converting when clean=true", async () => {
      const callOrder: string[] = [];

      const server = {
        connection: { onRequest: (_id: string, fn: unknown) => { (server as Record<string, unknown>)._handler = fn; } },
        getLanguageServiceById: () => ({
          cleanWorkflowText: async (text: string) => { callOrder.push("clean"); return text; },
          convertWorkflowText: async (_text: string) => { callOrder.push("convert"); return "converted"; },
        }),
      } as unknown as GalaxyWorkflowLanguageServer;

      ConvertWorkflowService.register(server);
      const handler = (server as unknown as Record<string, (p: unknown) => Promise<unknown>>)._handler;
      await handler({ contents: MINIMAL_FORMAT2_YAML, targetFormat: "native", clean: true });

      expect(callOrder).toEqual(["clean", "convert"]);
    });

    it("skips clean when clean=false", async () => {
      const callOrder: string[] = [];

      const server = {
        connection: { onRequest: (_id: string, fn: unknown) => { (server as Record<string, unknown>)._handler = fn; } },
        getLanguageServiceById: () => ({
          cleanWorkflowText: async (text: string) => { callOrder.push("clean"); return text; },
          convertWorkflowText: async (_text: string) => { callOrder.push("convert"); return "converted"; },
        }),
      } as unknown as GalaxyWorkflowLanguageServer;

      ConvertWorkflowService.register(server);
      const handler = (server as unknown as Record<string, (p: unknown) => Promise<unknown>>)._handler;
      await handler({ contents: MINIMAL_FORMAT2_YAML, targetFormat: "native" });

      expect(callOrder).toEqual(["convert"]);
    });
  });

  describe("request identifier", () => {
    it("registers under CONVERT_WORKFLOW_CONTENTS identifier", () => {
      let registeredId = "";
      const server = {
        connection: { onRequest: (id: string) => { registeredId = id; } },
        getLanguageServiceById: () => ({ convertWorkflowText: async () => "" }),
      } as unknown as GalaxyWorkflowLanguageServer;

      ConvertWorkflowService.register(server);
      expect(registeredId).toBe("galaxy-workflows-ls.convertWorkflowContents");
    });
  });
});
