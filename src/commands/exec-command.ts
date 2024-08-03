import * as process from 'node:process';

import { exec } from '../utils/exec.js';
import { Command, CommandConfig } from '../sdk/command.js';

import type * as Exec from '../utils/exec.js';

type ExecCommandConfig = CommandConfig & {
  // when true stderr / stdout are logged
  logStd?: boolean;

  // -> /home/rick.sanchez/my-awesome-node-project
  workingDirectory: string;
};

abstract class ExecCommand<T extends ExecCommandConfig> extends Command<T> {
  private logStd(stdout: string, stderr: string) {
    const log = this.config.logStd || process.env.EXEC_COMMAND_LOG_STD?.split(',').includes(this.getName());

    if (log) {
      if (stdout.length) {
        this.logger.error(stdout);
      }

      if (stderr.length) {
        this.logger.info(stderr);
      }
    }
  }

  protected createChildProcess = exec;

  protected async exec(command: Exec.ExecCommand, options?: Exec.ExecOptions): Promise<Exec.ExecaResult> {
    const result = await this.createChildProcess(command, {
      cwd: this.config.workingDirectory,
      ...options,
    });

    this.logStd(result.stdout.trimEnd(), result.stderr.trimEnd());

    return result;
  }
}

export { ExecCommand, ExecCommandConfig };
