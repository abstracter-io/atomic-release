import { ExecaCommand, ExecCommandConfig } from "../execa-command.js";

type GitPushBranchCommandConfig = ExecCommandConfig & {
  remote?: string;

  branchName: string;

  failWhenRemoteBranchExists?: boolean;
};

/**
 @example
 const command = GitPushCommand({
    remote: "custom-remote", <-- "origin" by default
    branchName: "v123-generated-files",
    failWhenRemoteBranchExists: false, <-- true by default
 });
 */
class GitPushBranchCommand extends ExecaCommand<GitPushBranchCommandConfig> {
  private readonly remote: string;

  private pushed: boolean;

  public constructor(config: GitPushBranchCommandConfig) {
    super(config);

    this.remote = config.remote ?? "origin";
  }

  private async push(): Promise<void> {
    await this.exec(`git push --set-upstream ${this.remote} ${this.config.branchName}`);
  }

  private async remoteBranchExists(): Promise<boolean> {
    const { stdout } = await this.exec(`git ls-remote ${this.remote} ${this.config.branchName}`);

    return stdout.length > 0;
  }

  public async undo(): Promise<void> {
    if (this.pushed) {
      this.logger.warn(`Cannot un-push remote branch '${this.config.branchName}'`);
    }
  }

  public async do(): Promise<void> {
    const remoteBranchExists = await this.remoteBranchExists();

    if (remoteBranchExists && (this.config.failWhenRemoteBranchExists ?? true)) {
      throw new Error(`Remote '${this.remote}' already has a branch named '${this.config.branchName}'`);
    }
    //
    else {
      await this.push();

      this.pushed = true;

      this.logger.info(`Pushed branch '${this.config.branchName}'`);
    }
  }
}

export { GitPushBranchCommand, GitPushBranchCommandConfig };
