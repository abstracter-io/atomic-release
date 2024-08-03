import fs from 'fs';
import type { PackageJson } from 'type-fest';

import { ExecCommand, ExecCommandConfig } from '../exec-command.js';

type NpmCommandConfig = ExecCommandConfig;

abstract class NpmCommand<T extends NpmCommandConfig> extends ExecCommand<T> {
  protected readonly packageJsonFilePath: string;

  public constructor(options: T) {
    super(options);

    this.packageJsonFilePath = `${options.workingDirectory}/package.json`;
  }

  protected async getPackageJson(): Promise<PackageJson> {
    const packageJson = await fs.promises.readFile(this.packageJsonFilePath, {
      flag: 'rs',
      encoding: 'utf-8',
    });

    return JSON.parse(packageJson);
  }
}

export { NpmCommand, NpmCommandConfig };
