import { makeNodeToolInfoService } from "@galaxy-tool-util/core/node";

interface Args {
  cacheDir: string;
  tools: Array<{ toolId: string; toolVersion?: string }>;
  toolShedUrl?: string;
}

async function main(): Promise<void> {
  const raw = process.argv[2];
  if (!raw) throw new Error("usage: populateTestCache.js <json-args>");
  const { cacheDir, tools, toolShedUrl }: Args = JSON.parse(raw);
  const svc = makeNodeToolInfoService({ cacheDir, defaultToolshedUrl: toolShedUrl });
  const failed: string[] = [];
  for (const { toolId, toolVersion } of tools) {
    try {
      const info = await svc.getToolInfo(toolId, toolVersion ?? null);
      if (!info) failed.push(toolId);
    } catch (e) {
      failed.push(`${toolId} (${(e as Error).message})`);
    }
  }
  if (failed.length) throw new Error(`failed to resolve: ${failed.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
