import parseAuthor from "parse-author";
import { ExecaCommand, ExecaCommandConfig } from "../execa-command";

type GitCommitCommandConfig = ExecaCommandConfig & {
  actor?: string;

  commitMessage: string;

  filePaths: Set<string>;
};

/**
 @example

 const command = new GitCommitCommand({
    actor: "bot <bot@mailbox.io>"
    commitMessage: "ci: adding files generated during CI/CD",
    workingDirectory: "/home/rick.sanchez/my-awesome-node-project",
    filePaths: new Set(["path/relative/to/working/directory/file.txt"]),
 });
 */
class GitCommitCommand extends ExecaCommand<GitCommitCommandConfig> {
  private filesCommitted: boolean;

  private async stageAndCommit(): Promise<void> {
    await this.execa("git", ["add", ...Array.from(this.config.filePaths)]);

    const commitEnvVars = {};

    if (this.config.actor) {
      const { name, email } = parseAuthor(this.config.actor);

      if (!name || !email) {
        throw new Error("actor must follow \"name <email>\" format");
      }

      Object.assign(commitEnvVars, {
        GIT_COMMITTER_NAME: name,
        GIT_COMMITTER_EMAIL: email,
        GIT_AUTHOR_NAME: name,
        GIT_AUTHOR_EMAIL: email,
      });
    }

    await this.execa("git", ["commit", "-m", this.config.commitMessage], {
      env: commitEnvVars,
    });
  }

  public async undo(): Promise<void> {
    if (this.filesCommitted) {
      await this.execa("git", ["reset", "HEAD~"]);
    }
  }

  public async do(): Promise<void> {
    await this.stageAndCommit();

    this.filesCommitted = true;

    this.logger.info(`Committed files ${Array.from(this.config.filePaths).join(", ")}`);
  }
}

export { GitCommitCommand, GitCommitCommandConfig };
