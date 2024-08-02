import to from "await-to-js";

import { ExecaCommand, ExecCommandConfig } from "../execa-command";

type GitTagCommandConfig = ExecCommandConfig & {
  name: string;
  remote?: string;
};

/**
 @example

 const command = new GitTagCommand({
    name: "v2",
    silent: true, <-- hides execution stderr/stdout
    workingDirectory: "/home/rick/dev/project",
    remote: "custom-remote", <-- "origin" by default
 });
 */
class GitTagCommand extends ExecaCommand<GitTagCommandConfig> {
  private readonly remote: string;
  private readonly tagRef: string;

  private localTagCreated = false;
  private remoteTagCreated = false;

  public constructor(config: GitTagCommandConfig) {
    super(config);

    this.remote = config.remote ?? "origin";
    this.tagRef = `refs/tags/${config.name}`;
  }

  private async deleteLocalTag(): Promise<void> {
    if (this.localTagCreated) {
      const [error] = await to(this.exec(`git tag --delete ${this.config.name}`));

      if (error) {
        this.logger.error(new Error(`Failed to delete local tag '${this.config.name}'`));

        this.logger.error(error);
      }
      //
      else {
        this.logger.info(`Deleted local tag '${this.config.name}'`);
      }
    }
  }

  private async deleteRemoteTag(): Promise<void> {
    if (this.remoteTagCreated) {
      const [error] = await to(this.exec(`git push ${this.remote} --delete ${this.tagRef}`));

      if (error) {
        this.logger.error(new Error(`Failed to delete remote tag '${this.config.name}'`));

        this.logger.error(error);
      }
      else {
        this.logger.info(`Deleted remote tag '${this.config.name}'`);
      }
    }
  }

  private async localTagExists(): Promise<boolean> {
    const { stdout } = await this.exec(`git tag --list ${this.config.name}`);

    return stdout.length > 0;
  }

  private async createLocalTag(): Promise<void> {
    const localTagExists = await this.localTagExists();

    if (!localTagExists) {
      const { childProcess } = await this.exec(`git tag ${this.config.name}`);

      if (childProcess.exitCode == 0) {
        this.localTagCreated = true;

        this.logger.info(`Created a local tag '${this.config.name}'`);

        return;
      }

      throw new Error(`Creating local tag failed. Exit code is: ${childProcess.exitCode}`);
    }

    throw new Error(`A local tag named '${this.config.name}' already exists`);
  }

  private async remoteTagExists(): Promise<boolean> {
    const { stdout } = await this.exec(`git ls-remote ${this.remote} ${this.tagRef}`);

    return stdout.length > 0;
  }

  private async createRemoteTag(): Promise<void> {
    const remoteTagExists = await this.remoteTagExists();

    if (!remoteTagExists) {
      const { childProcess } = await this.exec(`git push ${this.remote} ${this.tagRef}`);

      if (childProcess.exitCode === 0) {
        this.remoteTagCreated = true;

        this.logger.info(`Pushed tag '${this.config.name}' to remote '${this.remote}'`);

        return;
      }

      throw new Error(`Failed to create remote tag. Exit code is: ${childProcess.exitCode}`);
    }

    throw new Error(`A tag named '${this.config.name}' already exists in remote '${this.remote}'`);
  }

  public async undo(): Promise<void> {
    await this.deleteLocalTag();

    await this.deleteRemoteTag();
  }

  public async do(): Promise<void> {
    await this.createLocalTag();

    await this.createRemoteTag();
  }
}

export { GitTagCommand, GitTagCommandConfig };
