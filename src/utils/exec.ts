import { text } from "node:stream/consumers";
import { ChildProcess, spawn as nodeSpawn, SpawnOptionsWithoutStdio } from "node:child_process";

type ExecaResult = {
  stdout: string;
  stderr: string;
  childProcess: ChildProcess;
};

const exec = (cmd: string, options: SpawnOptionsWithoutStdio): Promise<ExecaResult> => {
  return new Promise((resolve, reject) => {
    try {
      const [command, ...args] = cmd.split(" ");
      const childProcess = nodeSpawn(command, args, options);
      const streams = Promise.all([
        text(childProcess.stdout),
        text(childProcess.stderr),
      ]);

      childProcess.on('error', reject);

      childProcess.on('close', (_code) => {
        streams
          .then(([stdout, stderr]) => {
            resolve({ childProcess, stdout, stderr });
          })
          .catch(err => reject(err));
      });
    }
    catch (err) {
      reject(err);
    }
  });
};

export { exec }

export type { SpawnOptionsWithoutStdio as ExecOptions, ExecaResult };
