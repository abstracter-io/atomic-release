import to from "await-to-js";

import { ExecaCommand, ExecaCommandOptions } from "../execa-command";

type GitTagCommandOptions = ExecaCommandOptions & {
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
class GitTagCommand extends ExecaCommand<GitTagCommandOptions> {
  private readonly remote: string;
  private readonly tagRef: string;

  private localTagCreated = false;
  private remoteTagCreated = false;

  public constructor(options: GitTagCommandOptions) {
    super(options);

    this.remote = options.remote ?? "origin";
    this.tagRef = `refs/tags/${options.name}`;
  }

  private async deleteLocalTag(): Promise<void> {
    if (this.localTagCreated) {
      const [error] = await to(this.execa("git", ["tag", "--delete", this.options.name]));

      if (error) {
        this.logger.error(new Error(`Failed to delete local tag '${this.options.name}'`));

        this.logger.error(error);
      }
      //
      else {
        this.logger.info(`Deleted local tag '${this.options.name}'`);
      }
    }
  }

  private async deleteRemoteTag(): Promise<void> {
    if (this.remoteTagCreated) {
      const [error] = await to(this.execa("git", ["push", this.remote, "--delete", this.tagRef]));

      if (error) {
        this.logger.error(new Error(`Failed to delete remote tag '${this.options.name}'`));

        this.logger.error(error);
      }
      //
      else {
        this.logger.info(`Deleted remote tag '${this.options.name}'`);
      }
    }
  }

  private async localTagExists(): Promise<boolean> {
    const { stdout } = await this.execa("git", ["tag", "--list", this.options.name]);

    return stdout.length > 0;
  }

  private async createLocalTag(): Promise<boolean> {
    const { exitCode } = await this.execa("git", ["tag", this.options.name]);

    return exitCode === 0;
  }

  private async remoteTagExists(): Promise<boolean> {
    const { stdout } = await this.execa("git", ["ls-remote", this.remote, this.tagRef]);

    return stdout.length > 0;
  }

  private async createRemoteTag(): Promise<boolean> {
    const { exitCode } = await this.execa("git", ["push", this.remote, this.tagRef]);

    return exitCode === 0;
  }

  public async undo(): Promise<void> {
    await this.deleteLocalTag();

    await this.deleteRemoteTag();
  }

  public async do(): Promise<void> {
    const tagName = this.options.name;
    const remoteTagExists = await this.remoteTagExists();

    if (remoteTagExists) {
      throw new Error(`A tag named '${tagName}' already exists in remote '${this.remote}'`);
    }
    //
    else {
      const localTagExists = await this.localTagExists();

      if (localTagExists) {
        throw new Error(`A local tag named '${tagName}' already exists`);
      }

      this.localTagCreated = await this.createLocalTag();
      this.remoteTagCreated = await this.createRemoteTag();

      this.logger.info(`Created a local tag '${tagName}'`);
      this.logger.info(`Pushed tag '${tagName}' to remote '${this.remote}'`);
    }
  }
}

export { GitTagCommand, GitTagCommandOptions };
