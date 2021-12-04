import { ExecaCommand, ExecaCommandOptions } from "../execa-command";

type GitPushBranchCommandOptions = ExecaCommandOptions & {
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
class GitPushBranchCommand extends ExecaCommand<GitPushBranchCommandOptions> {
  private readonly remote: string;

  private remoteBranchCreated: boolean;

  public constructor(options: GitPushBranchCommandOptions) {
    super(options);

    this.remote = options.remote ?? "origin";
  }

  private async push(): Promise<void> {
    await this.execa("git", ["push", "--set-upstream", this.remote, this.options.branchName]);
  }

  private async remoteBranchExists(): Promise<boolean> {
    const { stdout } = await this.execa("git", ["ls-remote", this.remote, this.options.branchName]);

    return stdout.length > 0;
  }

  public async undo(): Promise<void> {
    if (this.remoteBranchCreated) {
      await this.execa("git", ["push", this.remote, "--delete", this.options.branchName]);

      this.logger.info(`Deleted remote branch '${this.options.branchName}'`);
    }
  }

  public async do(): Promise<void> {
    const remoteBranchExists = await this.remoteBranchExists();

    if (remoteBranchExists && (this.options.failWhenRemoteBranchExists ?? true)) {
      throw new Error(`Remote '${this.remote}' already has a branch named '${this.options.branchName}'`);
    }
    //
    else {
      await this.push();

      this.remoteBranchCreated = true;

      this.logger.info(`Pushed branch '${this.options.branchName}'`);
    }
  }
}

export { GitPushBranchCommand, GitPushBranchCommandOptions };
