import * as SDK from "../";

import { GitClient } from "../ports/git-client";
import { GitExecaClient } from "../adapters/git-execa-client";

type IsReleaseBranch = (branchName: string) => boolean;

type GitStrategyOptions = SDK.StrategyOptions & {
  gitClient?: GitExecaClient;

  isReleaseBranch?: IsReleaseBranch;
};

abstract class GitStrategy<T extends GitStrategyOptions> extends SDK.Strategy<T> {
  private readonly isReleaseBranch: IsReleaseBranch;

  protected readonly gitClient: GitClient;

  protected constructor(options: T) {
    super(options);

    if (!options.gitClient) {
      this.gitClient = new GitExecaClient({
        remote: "origin",
        workingDirectory: process.cwd(),
      });
    }
    //
    else {
      this.gitClient = options.gitClient;
    }

    this.isReleaseBranch = options.isReleaseBranch ?? (() => true);
  }

  protected async shouldRun(): Promise<boolean> {
    const branchName = await this.gitClient.refName("HEAD");

    if (this.isReleaseBranch(branchName)) {
      const localHash = await this.gitClient.refHash(branchName);
      const remoteHash = await this.gitClient.remoteBranchHash(branchName);

      this.logger.info(`Local branch hash is ${localHash}`);
      this.logger.info(`Remote branch hash is ${remoteHash}`);

      if (localHash !== remoteHash) {
        this.logger.info(`Local branch hash is not the same as its remote counterpart`);

        return false;
      }

      return true;
    }
    //
    else {
      this.logger.info(`Branch '${branchName}' is not a release branch`);
    }

    return false;
  }
}

export { GitStrategy, GitStrategyOptions };
