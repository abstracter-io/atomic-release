import { NpmCommand, NpmCommandOptions } from "./npm-command";

type NpmPublishPackageCommandOptions = NpmCommandOptions & {
  tag?: string;
  registry?: string;
  undoPublish?: boolean;
};

/*
  <b>NOTE</b>: THIS COMMAND SHOULD BE THE LAST COMMAND TO EXECUTE.

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
class NpmPublishPackageCommand extends NpmCommand<NpmPublishPackageCommandOptions> {
  private publishedPackage: string;

  public constructor(options: NpmPublishPackageCommandOptions) {
    super(options);
  }

  private async unpublish(): Promise<void> {
    await this.execa("npm", ["unpublish", this.publishedPackage], {
      cwd: this.options.workingDirectory,
    });
  }

  private async publish(args: string[]): Promise<void> {
    await this.execa("npm", ["publish", ...args], {
      cwd: this.options.workingDirectory,
    });
  }

  public async undo(): Promise<void> {
    if (this.publishedPackage && this.options.undoPublish === true) {
      await this.unpublish();
    }
  }

  public async do(): Promise<void> {
    const { name, version, ...pkg } = await this.getPackageJson();

    if (pkg.private) {
      this.logger.info(`Skipping publish. Package '${name}' private property is true.`);
    }
    //
    else {
      const args: string[] = [];
      const { tag, registry } = this.options;

      if (tag) {
        args.push("--tag", tag);

        this.logger.info(`Publishing '${name}@${version}' using dist tag '${tag}'`);
      }

      if (registry) {
        args.push("--registry", registry);

        this.logger.info(`Publishing '${name}@${version}' to registry '${registry}'`);
      }

      await this.publish(args);

      this.logger.info(`Published package '${name}@${version}'`);

      this.publishedPackage = `${name}@${version}`;
    }
  }
}

export { NpmPublishPackageCommand, NpmPublishPackageCommandOptions };
