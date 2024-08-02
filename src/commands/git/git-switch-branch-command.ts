import { ExecaCommand, ExecCommandConfig } from "../execa-command.js";

type GitSwitchCommandOptions = ExecCommandConfig & {
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

  private async branchName() {
    const result = await this.exec("git rev-parse --abbrev-ref HEAD");

    return result.stdout.trim();
  }

  private async branchExists(branchName: string) {
    const subprocess = this.exec(`git rev-parse --verify refs/heads/${branchName}`);

    return subprocess
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  }

  private async switch(branchName: string, create: boolean): Promise<void> {
    await this.exec(`git switch ${create ? '-c ' : ''}${branchName}`);

    this.logger.info(`Switched to branch '${branchName}'`);
  }

  public async undo(): Promise<void> {
    if (this.initialBranchName) {
      await this.switch(this.initialBranchName, false);
    }

    if (this.createdBranch) {
      await this.exec(`git branch -D ${this.config.branchName}`);

      this.logger.info(`Deleted branch '${this.config.branchName}'`);
    }
  }

  public async do(): Promise<void> {
    const branchName = this.config.branchName;
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
