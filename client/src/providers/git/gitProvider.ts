import { Extension, extensions, Uri } from "vscode";
import { GitExtension, API as GitAPI } from "../../@types/git";

export class BuiltinGitProvider {
  async getContents(uri: Uri, ref: string): Promise<string> {
    const git = await this.getBuiltInGitApi();
    const gitUri = git.toGitUri(uri, ref);
    const repo = git.getRepository(gitUri);
    const contents = await repo.show(ref, uri.path);

    return contents;
  }

  private async getBuiltInGitApi(): Promise<GitAPI> {
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
