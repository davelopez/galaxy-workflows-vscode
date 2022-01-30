import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log(`${context.extension.id} is now active in the web extension host.`);
}

export function deactivate() {}
