import fs from "fs";
import type { PackageJson } from "type-fest";

import { ExecaCommand, ExecaCommandConfig } from "../execa-command";

type NpmCommandConfig = ExecaCommandConfig;

abstract class NpmCommand<T extends NpmCommandConfig> extends ExecaCommand<T> {
  protected readonly packageJsonFilePath: string;

  public constructor(options: T) {
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

export { NpmCommand, NpmCommandConfig };
