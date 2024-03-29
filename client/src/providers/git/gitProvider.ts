import { Extension, extensions, Uri } from "vscode";
import { GitExtension, API as GitAPI } from "../../@types/git";
import { GitProvider } from ".";

/**
 * Implementation of a GitProvider using the `vscode.git` extension.
 * This providers can be used only with local git repositories.
 */
export class BuiltinGitProvider implements GitProvider {
  private gitAPI?: GitAPI = undefined;

  async initialize(): Promise<void> {
    this.gitAPI = await this.getBuiltInGitApi();
  }

  get isInitialized(): boolean {
    return this.gitAPI !== undefined;
  }

  async getContents(uri: Uri, ref: string): Promise<string> {
    if (this.gitAPI === undefined) {
      throw new Error("Git provider not initialized");
    }
    const gitUri = this.gitAPI.toGitUri(uri, ref);
    const repo = this.gitAPI.getRepository(gitUri);
    if (repo === null) {
      throw new Error(`Repository not found for uri ${uri.toString()}`);
    }
    const contents = await repo.show(ref, uri.path);

    return contents;
  }

  private async getBuiltInGitApi(): Promise<GitAPI | undefined> {
    try {
      const extension = extensions.getExtension("vscode.git") as Extension<GitExtension>;
      if (extension !== undefined) {
        const gitExtension = extension.isActive ? extension.exports : await extension.activate();
        return gitExtension.getAPI(1);
      }
    } catch (err) {
      console.error(err);
    }

    return undefined;
  }
}
