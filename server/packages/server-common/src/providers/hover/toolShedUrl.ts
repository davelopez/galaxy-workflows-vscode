/**
 * Parse a ToolShed tool id of the form `<host>/repos/<owner>/<repo>/<tool>/<version>`
 * and return the `https://<host>/view/<owner>/<repo>` repo-view URL.
 *
 * Returns `null` for short (built-in) tool ids or malformed inputs.
 */
export function parseToolShedRepoUrl(toolId: string): string | null {
  if (!toolId) return null;
  const parts = toolId.split("/");
  // Expected: host, "repos", owner, repo, tool, version
  if (parts.length < 6) return null;
  const [host, repos, owner, repo] = parts;
  if (repos !== "repos") return null;
  if (!host || !owner || !repo) return null;
  if (host.includes(" ")) return null;
  return `https://${host}/view/${owner}/${repo}`;
}
