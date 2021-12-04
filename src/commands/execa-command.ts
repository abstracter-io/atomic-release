import execa from "execa";

import { Command, CommandOptions } from "../";

type ExecaResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type ExecaCommandOptions = CommandOptions & {
  // when true, stderr / stdout are not piped to parent process
  silent?: boolean;

  // -> /home/rick.sanchez/my-awesome-node-project
  workingDirectory: string;
};

abstract class ExecaCommand<T extends ExecaCommandOptions> extends Command<T> {
  protected async execa(script: string, args: string[], options?: execa.Options): Promise<ExecaResult> {
    const subprocess = execa(script, args, {
      cwd: this.options.workingDirectory,
      ...options,
    });

    if (!(this.options.silent ?? true)) {
      subprocess.stdout?.pipe(process.stdout);
      subprocess.stderr?.pipe(process.stderr);
    }

    const result = await subprocess;

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  }
}

export { ExecaCommand, ExecaCommandOptions };
