import { ExecaCommand, ExecaCommandOptions } from "../execa-command";

type GitSwitchCommandOptions = ExecaCommandOptions & {
  branchName: string;
};

/**
 @example

 const command = new GitSwitchBranchCommand({
    branchName: "v1.2.3-generated-files";
 });
 */
class GitSwitchBranchCommand extends ExecaCommand<GitSwitchCommandOptions> {
  private initialBranchName: string;
  private createdBranch: boolean;

  public constructor(options: GitSwitchCommandOptions) {
    super(options);
  }

  private async branchName() {
    const result = await this.execa("git", ["rev-parse", "--abbrev-ref", "HEAD"]);

    return result.stdout.trim();
  }

  private async branchExists(branchName: string) {
    const subprocess = this.execa("git", ["rev-parse", "--verify", `refs/heads/${branchName}`]);

    return subprocess.then(() => true).catch(() => false);
  }

  private async switch(branchName: string, create: boolean): Promise<void> {
    const args = create ? ["switch", "-c", branchName] : ["switch", branchName];

    await this.execa("git", args);

    this.logger.info(`Switched to branch '${branchName}'`);
  }

  public async undo(): Promise<void> {
    if (this.initialBranchName) {
      await this.switch(this.initialBranchName, false);
    }

    if (this.createdBranch) {
      await this.execa("git", ["branch", "-D", this.options.branchName]);

      this.logger.info(`Deleted branch '${this.options.branchName}'`);
    }
  }

  public async do(): Promise<void> {
    const branchName = this.options.branchName;
    const currentBranch = await this.branchName();

    if (!branchName) {
      throw new Error("Missing branch name");
    }
    //
    else if (branchName !== currentBranch) {
      const branchExists = await this.branchExists(branchName);

      await this.switch(branchName, !branchExists);

      if (!branchExists) {
        this.createdBranch = true;
      }

      this.initialBranchName = currentBranch;
    }
  }
}

export { GitSwitchBranchCommand, GitSwitchCommandOptions };
