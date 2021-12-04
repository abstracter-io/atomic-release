import parseAuthor from "parse-author";
import { ExecaCommand, ExecaCommandOptions } from "../execa-command";

type GitCommitCommandOptions = ExecaCommandOptions & {
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
class GitCommitCommand extends ExecaCommand<GitCommitCommandOptions> {
  private filesCommitted: boolean;

  public constructor(options: GitCommitCommandOptions) {
    super(options);
  }

  private async stageAndCommit(): Promise<void> {
    await this.execa("git", ["add", ...Array.from(this.options.filePaths)]);

    const commitEnvVars = {};

    if (this.options.actor) {
      const { name, email } = parseAuthor(this.options.actor);

      if (!name || !email) {
        throw new Error(`actor must follow "name <email>" format`);
      }

      Object.assign(commitEnvVars, {
        GIT_COMMITTER_NAME: name,
        GIT_COMMITTER_EMAIL: email,
        GIT_AUTHOR_NAME: name,
        GIT_AUTHOR_EMAIL: email,
      });
    }

    await this.execa("git", ["commit", "-m", this.options.commitMessage], {
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

    this.logger.info(`Committed files ${Array.from(this.options.filePaths).join(", ")}`);
  }
}

export { GitCommitCommand, GitCommitCommandOptions };
