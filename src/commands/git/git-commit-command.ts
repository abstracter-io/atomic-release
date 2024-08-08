import parseAuthor from 'parse-author';
import { ExecCommand, ExecCommandConfig } from '../exec-command.js';

type GitCommitCommandConfig = ExecCommandConfig & {
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
class GitCommitCommand extends ExecCommand<GitCommitCommandConfig> {
  private commited: boolean;
  private filesStaged: boolean;

  private async stageFiles(): Promise<void> {
    const { childProcess, stderr, stdout } = await this.exec(`git add ${Array.from(this.config.filePaths).join(' ')}`);

    if (childProcess.exitCode !== 0) {
      throw new Error(`Staging failed. exit code is ${childProcess.exitCode} ${stderr} ${stdout}`);
    }

    this.filesStaged = true;
  }

  private async commit(): Promise<void> {
    const commitEnvVars = {
      ...process.env,
    };

    if (this.config.actor) {
      const { name, email } = parseAuthor(this.config.actor);

      if (!name || !email) {
        throw new Error('actor must follow "name <email>" format');
      }

      Object.assign(commitEnvVars, {
        GIT_COMMITTER_NAME: name,
        GIT_COMMITTER_EMAIL: email,
        GIT_AUTHOR_NAME: name,
        GIT_AUTHOR_EMAIL: email,
      });
    }

    const result = await this.exec({ command: 'git', args: ['commit', '-m', this.config.commitMessage] }, {
      env: commitEnvVars,
    });

    if (result.childProcess.exitCode !== 0) {
      throw new Error(`Commit failed. exit code is ${result.childProcess.exitCode}`);
    }

    this.config.filePaths.forEach((filePath) => {
      this.logger.info(`Committed file ${filePath}`);
    });

    this.commited = true;
  }

  public async undo(): Promise<void> {
    if (this.filesStaged) {
      await this.exec(`git restore --staged ${Array.from(this.config.filePaths).join(' ')}`);
    }

    if (this.commited) {
      await this.exec('git reset HEAD~');
    }
  }

  public async do(): Promise<void> {
    await this.stageFiles();

    await this.commit();
  }
}

export { GitCommitCommand, GitCommitCommandConfig };
