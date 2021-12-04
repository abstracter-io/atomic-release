import { NpmCommand, NpmCommandOptions } from "./npm-command";

type NpmBumpPackageVersionCommandOptions = NpmCommandOptions & {
  version: string;
  preReleaseId?: string;
};

/**
 @example bumping to "0.0.1-beta.0" (assuming current version is 0.0.1)
 const command = new NpmBumpPackageVersionCommand({
    preReleaseId: "beta",
    workingDirectory: "/absolute/path", <-- package.json should be inside
 });

 <br>

 @example bumping to "1.1.0" (does not matter what the current version is)
 const command = new NpmBumpPackageVersionCommand({
    version: "1.1.0",
    workingDirectory: "/absolute/path", <-- package.json should be inside
 });
 */
class NpmBumpPackageVersionCommand extends NpmCommand<NpmBumpPackageVersionCommandOptions> {
  private initialVersion: string;
  private versionChanged: boolean;

  public constructor(options: NpmBumpPackageVersionCommandOptions) {
    super(options);
  }

  private async bumpVersion(): Promise<string> {
    const { version, preReleaseId } = this.options;

    await this.executeVersionCommand(version);

    if (preReleaseId) {
      await this.executeVersionCommand(`prerelease --preid=${preReleaseId}`);
    }

    return (await this.getPackageJson()).version as string;
  }

  private async executeVersionCommand(arg: string): Promise<void> {
    await this.execa("npm", ["version", ...arg.split(" "), "--no-git-tag-version"], {
      cwd: this.options.workingDirectory,
    });
  }

  public async do(): Promise<void> {
    const { version, name } = await this.getPackageJson();

    if (!version || !name) {
      throw new Error(`Package ${this.packageJsonFilePath} 'version' or 'name' properties are missing`);
    }

    this.initialVersion = version;

    this.logger.info(`Changed package '${name}' version to '${await this.bumpVersion()}'`);

    this.versionChanged = true;
  }

  public async undo(): Promise<void> {
    if (this.versionChanged) {
      const { name, version } = await this.getPackageJson();
      const initialVersion = this.initialVersion;

      if (version !== initialVersion) {
        await this.executeVersionCommand(initialVersion);
      }

      this.logger.info(`Reverted '${name}' version back to '${initialVersion}'`);
    }
  }
}

export { NpmBumpPackageVersionCommand, NpmBumpPackageVersionCommandOptions };
