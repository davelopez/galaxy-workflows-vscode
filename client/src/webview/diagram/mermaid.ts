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

function pickTheme(): "dark" | "default" {
  return document.body.classList.contains("vscode-dark") || document.body.classList.contains("vscode-high-contrast")
    ? "dark"
    : "default";
}

function applyTheme(theme: "dark" | "default"): void {
  mermaid.initialize({ startOnLoad: false, theme, securityLevel: "strict" });
}

applyTheme(pickTheme());

const root = document.getElementById("root") as HTMLElement;
const vscode = acquireVsCodeApi();

let renderSeq = 0;
let lastSource: string | undefined;
let lastError: string | undefined;

async function renderSource(source: string): Promise<void> {
  const id = `diagram-${++renderSeq}`;
  try {
    const { svg } = await mermaid.render(id, source);
    root.innerHTML = svg;
  } catch (e) {
    showError(String(e));
    vscode.postMessage({ type: "error", message: String(e) });
  }
}

window.addEventListener("message", (ev: MessageEvent<RenderMessage>) => {
  const msg = ev.data;
  if (msg.type !== "render") return;
  if (msg.error) {
    lastError = msg.error;
    lastSource = undefined;
    showError(msg.error);
    return;
  }
  lastError = undefined;
  lastSource = msg.payload ?? "";
  void renderSource(lastSource);
});

// Re-render on theme change. VS Code toggles classes on document.body when the
// user switches color theme, so a MutationObserver picks that up without any
// host-side coordination.
let lastTheme = pickTheme();
new MutationObserver(() => {
  const theme = pickTheme();
  if (theme === lastTheme) return;
  lastTheme = theme;
  applyTheme(theme);
  if (lastError !== undefined) {
    showError(lastError);
  } else if (lastSource !== undefined) {
    void renderSource(lastSource);
  }
}).observe(document.body, { attributes: true, attributeFilter: ["class"] });

function showError(message: string): void {
  const pre = document.createElement("pre");
  pre.className = "error";
  pre.textContent = message;
  root.replaceChildren(pre);
}

vscode.postMessage({ type: "ready" });
