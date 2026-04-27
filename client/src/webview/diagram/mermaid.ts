import mermaid from "mermaid";

interface VsCodeApi {
  postMessage(message: unknown): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

interface RenderMessage {
  type: "render";
  payload?: string;
  error?: string;
}

const isDark = document.body.classList.contains("vscode-dark") || document.body.classList.contains("vscode-high-contrast");
mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default", securityLevel: "strict" });

const root = document.getElementById("root") as HTMLElement;
const vscode = acquireVsCodeApi();

let renderSeq = 0;

window.addEventListener("message", async (ev: MessageEvent<RenderMessage>) => {
  const msg = ev.data;
  if (msg.type !== "render") return;
  if (msg.error) {
    showError(msg.error);
    return;
  }
  const source = msg.payload ?? "";
  const id = `diagram-${++renderSeq}`;
  try {
    const { svg } = await mermaid.render(id, source);
    root.innerHTML = svg;
  } catch (e) {
    showError(String(e));
    vscode.postMessage({ type: "error", message: String(e) });
  }
});

function showError(message: string): void {
  const pre = document.createElement("pre");
  pre.className = "error";
  pre.textContent = message;
  root.replaceChildren(pre);
}

vscode.postMessage({ type: "ready" });
