import { text } from 'node:stream/consumers';
import { ChildProcess, spawn as nodeSpawn, SpawnOptionsWithoutStdio } from 'node:child_process';

type ExecCommand = string | { command: string; args: string[] };

type ExecaResult = {
  stdout: string;
  stderr: string;
  childProcess: ChildProcess;
};

const extractCommandAndArgs = (cmd: ExecCommand) => {
  if (typeof cmd === 'string') {
    const [command, ...args] = cmd.split(' ');

    return {
      command,
      args,
    };
  }

  return cmd;
};

const exec = (cmd: ExecCommand, options: SpawnOptionsWithoutStdio): Promise<ExecaResult> => {
  return new Promise((resolve, reject) => {
    try {
      const { command, args } = extractCommandAndArgs(cmd);
      const childProcess = nodeSpawn(command, args, options);
      const streams = Promise.all([
        text(childProcess.stdout),
        text(childProcess.stderr),
      ]);

      childProcess.on('error', reject);

      childProcess.on('close', (_code) => {
        streams
          .then(([stdout, stderr]) => {
            return {
              stdout: stdout.trimEnd(),
              stderr: stderr.trimEnd(),
              childProcess,
            };
          })
          .then(resolve)
          .catch(reject);
      });
    }
    catch (err) {
      reject(err);
    }
  });
};

export { exec };

export type { ExecCommand, SpawnOptionsWithoutStdio as ExecOptions, ExecaResult };
