import { NpmCommand, NpmCommandConfig } from './npm-command.js';

type NpmBumpPackageVersionCommandConfig = NpmCommandConfig & {
  version: string;
  preReleaseId?: string;
};

/**
 @example bumping to "0.0.1-beta.0" (assuming current version is 0.0.1)
 const command = new NpmBumpPackageVersionCommand({
    preReleaseId: "beta",
    workingDirectory: "/absolute/path", <-- package.json should be inside
 });
---
 @example bumping to "1.1.0" (does not matter what the current version is)
 const command = new NpmBumpPackageVersionCommand({
    version: "1.1.0",
    workingDirectory: "/absolute/path", <-- package.json should be inside
 });
 */
class NpmBumpPackageVersionCommand extends NpmCommand<NpmBumpPackageVersionCommandConfig> {
  private initialVersion: string;
  private versionChanged: boolean;

  private async versionCmd(arg: string): Promise<void> {
    await this.exec(`npm version ${arg} --no-git-tag-version`);
  }

  private async bumpVersion(): Promise<string> {
    const preReleaseId = this.config.preReleaseId;

    await this.versionCmd(this.config.version);

    if (preReleaseId) {
      await this.versionCmd(`prerelease --preid=${preReleaseId}`);
    }

    return (await this.getPackageJson()).version as string;
  }

  public async do(): Promise<void> {
    const { version, name } = await this.getPackageJson();

    if (version && name) {
      this.initialVersion = version;

      if (this.config.version !== version) {
        const changedVersion = await this.bumpVersion();

        this.logger.info(`Changed package '${name}' version to '${changedVersion}'`);

        this.versionChanged = true;

        return;
      }

      throw new Error('version should have changed');
    }

    throw new Error(`Package ${this.packageJsonFilePath} 'version' or 'name' properties are missing`);
  }

  public async undo(): Promise<void> {
    if (this.versionChanged) {
      const { name } = await this.getPackageJson();
      const initialVersion = this.initialVersion;

      await this.versionCmd(initialVersion);

      this.logger.info(`Reverted '${name}' version back to '${initialVersion}'`);
    }
  }
}

export { NpmBumpPackageVersionCommand, NpmBumpPackageVersionCommandConfig };
