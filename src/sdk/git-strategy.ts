import { Strategy, StrategyConfig } from "./strategy";

import { GitClient } from "./git-client";

type GitStrategyOptions = StrategyConfig & {
  gitClient: GitClient;
  releaseBranchNames: Set<string>;
};

class GitStrategy<T extends GitStrategyOptions = GitStrategyOptions> extends Strategy<T> {
  public constructor(config: T) {
    super(config);
  }

  protected async shouldRun(): Promise<boolean> {
    if (await super.shouldRun()) {
      const branchName = await this.config.gitClient.refName("HEAD");

      if (this.config.releaseBranchNames.has(branchName)) {
        const [localHash, remoteHash] = await Promise.all([
          this.config.gitClient.refHash(branchName),
          this.config.gitClient.remoteBranchHash(branchName),
        ]);

        this.config.logger.info(`Local branch hash is ${localHash}`);

        this.config.logger.info(`Remote branch hash is ${remoteHash}`);

        if (localHash === remoteHash) {
          return true;
        }

        this.config.logger.info("Local branch hash is not the same as its remote counterpart");
      }

      this.config.logger.info(`Branch '${branchName}' is not a release branch`);
    }

    return false;
  }
}

export { GitStrategy, GitStrategyOptions };
