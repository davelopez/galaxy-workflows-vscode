import * as path from "path";
import { ExtensionContext } from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";
import { LanguageClient, ServerOptions, TransportKind } from "vscode-languageclient/node";
import { buildLanguageClientOptions, initExtension } from "./common";

export function activate(context: ExtensionContext) {
  const client = buildLanguageClient(context);

  initExtension(context, client);
}

export function deactivate() {}

function buildLanguageClient(context: ExtensionContext) {
  const clientOptions: LanguageClientOptions = buildLanguageClientOptions();
  const serverOptions: ServerOptions = buildServerOptions(context);
  return new LanguageClient(
    "galaxy-workflow-language-client-native",
    "Galaxy Workflows LS",
    serverOptions,
    clientOptions
  );
}

function buildServerOptions(context: ExtensionContext) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(path.join("server", "dist", "nativeServer.js"));
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };
  return serverOptions;
}
