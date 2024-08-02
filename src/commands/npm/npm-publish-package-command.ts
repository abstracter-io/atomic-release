import { NpmCommand, NpmCommandConfig } from "./npm-command";

type NpmPublishPackageCommandConfig = NpmCommandConfig & {
  tag?: string;
  registry?: string;
  undoPublish?: boolean;
};

/*
  <b>NOTE</b>: THIS COMMAND MOST LIKELY NEED TO BE THE LAST COMMAND TO EXECUTE.

  The commonly used registry (https://registry.npmjs.org) does
  allow removing a published package but does not allow publishing
  the same version even though it was unpublished... :facepalm:

  Assuming the registry in use does not impose
  such a limit, there is an option called "undoPublish" that will
  control whether this command undo should "unpublish"
*/

/**
 @example
 const command = new NpmPublishPackageCommand({
    tag: "beta", <-- i.e. npm install <packageName>@beta
    registry: "https://npm.evil-corp.com"
    undoPublish: true, <-- this should be true only when the registry support publishing the same version again.
    workingDirectory: "/absolute/path", <-- package.json should be inside
 });
 */
class NpmPublishPackageCommand extends NpmCommand<NpmPublishPackageCommandConfig> {
  private publishedPackage: string;

  private async publish(args: string): Promise<void> {
    await this.exec(`npm publish ${args}`);
  }

  public async undo(): Promise<void> {
    if (this.publishedPackage && this.config.undoPublish === true) {
      await this.exec(`npm unpublish ${this.publishedPackage}`);
    }
  }

  public async do(): Promise<void> {
    const { name, version, ...pkg } = await this.getPackageJson();

    if (pkg.private) {
      this.logger.info(`Skipping publish. Package '${name}' private property is true.`);
    }
    else {
      const args: string[] = [];
      const { tag, registry } = this.config;

      if (tag) {
        args.push("--tag", tag);

        this.logger.info(`Publishing '${name}@${version}' using dist tag '${tag}'`);
      }

      if (registry) {
        args.push("--registry", registry);

        this.logger.info(`Publishing '${name}@${version}' to registry '${registry}'`);
      }

      await this.publish(args.join(' '));

      this.logger.info(`Published package '${name}@${version}'`);

      this.publishedPackage = `${name}@${version}`;
    }
  }
}

export { NpmPublishPackageCommand, NpmPublishPackageCommandConfig };
