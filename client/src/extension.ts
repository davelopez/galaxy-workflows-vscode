import * as path from "path";
import { ExtensionContext } from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";
import { LanguageClient, ServerOptions, TransportKind } from "vscode-languageclient/node";
import { setupCommands } from "./commands/setup";
import { buildLanguageClientOptions } from "./common";
import { CleanWorkflowDocumentProvider } from "./providers/cleanWorkflowDocumentProvider";

export function activate(context: ExtensionContext) {
  console.log(`${context.extension.id} is now active in the web extension host.`);

  const client = startLanguageClient(context);

  setupProviders(context, client);

  setupCommands(context, client);
}

export function deactivate() {}

function startLanguageClient(context: ExtensionContext) {
  const clientOptions: LanguageClientOptions = buildLanguageClientOptions();

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

  const client = createLanguageClient(context, serverOptions, clientOptions);

  const disposable = client.start();
  context.subscriptions.push(disposable);

  client.onReady().then(() => {
    console.log(`${context.extension.id} server is ready.`);
  });
  return client;
}

function createLanguageClient(
  context: ExtensionContext,
  serverOptions: ServerOptions,
  clientOptions: LanguageClientOptions
) {
  return new LanguageClient(
    "galaxy-workflow-language-client-native",
    "Galaxy Workflows LS",
    serverOptions,
    clientOptions
  );
}

function setupProviders(context: ExtensionContext, client: LanguageClient) {
  CleanWorkflowDocumentProvider.register(context, client);
}
