import fs from "fs";
import type { PackageJson } from "type-fest";

import { ExecaCommand, ExecaCommandOptions } from "../execa-command";

type NpmCommandOptions = ExecaCommandOptions;

abstract class NpmCommand<T extends NpmCommandOptions> extends ExecaCommand<T> {
  protected readonly packageJsonFilePath: string;

  protected constructor(options: T) {
    super(options);

    this.packageJsonFilePath = `${options.workingDirectory}/package.json`;
  }

  protected async getPackageJson(): Promise<PackageJson> {
    const packageJson = await fs.promises.readFile(this.packageJsonFilePath, {
      flag: "rs",
      encoding: "utf-8",
    });

    return JSON.parse(packageJson);
  }
}

export { NpmCommand, NpmCommandOptions };
