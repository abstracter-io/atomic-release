import { ChildProcess, exec as nodeExec } from "node:child_process";
import type { ExecException, ExecOptions, ExecOptionsWithStringEncoding } from "node:child_process";

type ExecaResult = {
  stdout: string;
  stderr: string;
  childProcess: ChildProcess;
};

// String only, for a more memory efficient usage, use spawn.
const exec = (command: string, options: ExecOptionsWithStringEncoding): Promise<ExecaResult> => {
  return new Promise((resolve, reject) => {
    const childProcess = nodeExec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      }
      else {
        resolve({ childProcess, stdout, stderr });
      }
    });
  });
}

const isExecException = (err: Error): err is ExecException => {
  return err.hasOwnProperty("code");
}

export { exec, isExecException }

export type { ExecException, ExecOptions, ExecaResult };

