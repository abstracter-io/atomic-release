import { exec } from '../utils/exec.js';
import { Command, CommandConfig } from "../sdk/command.js";

import type { ExecOptions, ExecaResult } from '../utils/exec.js';

type ExecCommandConfig = CommandConfig & {
  // when true, stderr / stdout are not piped to parent process
  silent?: boolean;

  // -> /home/rick.sanchez/my-awesome-node-project
  workingDirectory: string;
};

abstract class ExecaCommand<T extends ExecCommandConfig> extends Command<T> {
  private logStd(stdout: string, stderr: string) {
    const silent = (this.config.silent ?? true);

    if (!silent) {
      if (stdout.length) {
        this.logger.error(stdout);
      }

      if (stderr.length) {
        this.logger.info(stderr);
      }
    }
  }

  protected createChildProcess = exec;

  protected async exec(command: string, options?: ExecOptions): Promise<ExecaResult> {
    const result = await this.createChildProcess(command, {
      cwd: this.config.workingDirectory,
      ...options,
    });

    this.logStd(result.stdout.trimEnd(), result.stderr.trimEnd());

    return result;
  }
}

export { ExecaCommand, ExecCommandConfig };
