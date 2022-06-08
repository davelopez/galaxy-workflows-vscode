import * as path from "path";
import { ExtensionContext } from "vscode";
import { integer, LanguageClientOptions } from "vscode-languageclient";
import { LanguageClient, ServerOptions, TransportKind } from "vscode-languageclient/node";
import { buildBasicLanguageClientOptions, initExtension } from "./common";
import { Constants } from "./common/constants";

export function activate(context: ExtensionContext): void {
  const nativeLanguageClient = buildNodeLanguageClient(
    Constants.NATIVE_WORKFLOW_LANGUAGE_ID,
    buildNativeServerOptions(context)
  );
  const gxFormat2LanguageClient = buildNodeLanguageClient(
    Constants.GXFORMAT2_WORKFLOW_LANGUAGE_ID,
    buildGxFormat2ServerOptions(context)
  );

  initExtension(context, nativeLanguageClient, gxFormat2LanguageClient);
}

export function deactivate(): void {
  // Nothing to do yet
}

function buildNodeLanguageClient(languageId: string, serverOptions: ServerOptions): LanguageClient {
  const documentSelector = [{ language: languageId }];
  const clientOptions: LanguageClientOptions = buildBasicLanguageClientOptions(documentSelector);
  return new LanguageClient(
    `${languageId}-language-client`,
    `Galaxy Workflows (${languageId})`,
    serverOptions,
    clientOptions
  );
}

function buildNativeServerOptions(context: ExtensionContext): ServerOptions {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(path.join("server", "dist", "nativeServer.js"));
  const debugPort = 6009;
  return buildBasicNodeServerOptions(serverModule, debugPort);
}

function buildGxFormat2ServerOptions(context: ExtensionContext): ServerOptions {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(path.join("server", "dist", "gxFormat2Server.js"));
  const debugPort = 6010;
  return buildBasicNodeServerOptions(serverModule, debugPort);
}

function buildBasicNodeServerOptions(serverModule: string, debugPort: integer): ServerOptions {
  // The debug options for the server
  // --inspect=<port>: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ["--nolazy", `--inspect=${debugPort}`] };

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
