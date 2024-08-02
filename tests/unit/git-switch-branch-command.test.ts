import { vitest, describe, test, expect } from "vitest";

import { Stubs } from "../stubs";
import { Commands } from "../../src";

const CMD_CONFIG: Commands.GitSwitchCommandOptions = {
  logger: Stubs.NoopLogger.INSTANCE,
  workingDirectory: "/bla/bla",
  branchName: "v1.1.1",
};

class GitSwitchBranchCommandStub extends Commands.GitSwitchBranchCommand {
  constructor(config?: Partial<Commands.GitSwitchCommandOptions>) {
    super({ ...CMD_CONFIG, ...config });
  }

  public createChildProcess = vitest.fn(async (__args: any) => {
    return {
      stdout: "",
      stderr: "",
      childProcess: Stubs.childProcess(),
    };
  })
}

describe("switch git branch", () => {
  test("branch is switched", async () => {
    const logger = new Stubs.LoggerStub();
    const commandStub = new GitSwitchBranchCommandStub({ logger });

    commandStub.createChildProcess.mockImplementation(async (cmd) => {
      if (cmd === "git switch rev-parse --abbrev-ref HEAD") {
        return {
          stderr: "",
          stdout: Date.now().toString(),
          childProcess: Stubs.childProcess(),
        };
      }

      return {
        stderr: "",
        stdout: "",
        childProcess: Stubs.childProcess(),
      };
    });

    await commandStub.do();

    expect(logger.info).toBeCalledWith(`Switched to branch '${CMD_CONFIG.branchName}'`);

    expect(commandStub.createChildProcess).toBeCalledWith(`git switch ${CMD_CONFIG.branchName}`, {

      cwd: CMD_CONFIG.workingDirectory,
    });
  });

  test("branch is not switched", async () => {
    const commandStub = new GitSwitchBranchCommandStub();

    commandStub.createChildProcess.mockImplementation(async (cmd) => {
      if (cmd === "git rev-parse --abbrev-ref HEAD") {
        return {
          stderr: '',
          stdout: CMD_CONFIG.branchName,
          childProcess: Stubs.childProcess(),
        };
      }

      return {
        stderr: "",
        stdout: "",
        childProcess: Stubs.childProcess(),
      };
    });

    await commandStub.do();

    expect(commandStub.createChildProcess).not.toBeCalledWith(`git switch -c ${CMD_CONFIG.branchName}`, {
      cwd: CMD_CONFIG.workingDirectory,

    });
  });

  test("missing branch name throws", async () => {
    const expectedError = new Error("Missing branch name");
    const commandStub = new GitSwitchBranchCommandStub({
      branchName: undefined,
    });
    const error = await commandStub.do().catch((e) => {
      return e;
    });

    expect(error).toStrictEqual(expectedError);
  });

  test("undo deletes created branch", async () => {
    const logger = new Stubs.LoggerStub();
    const commandStub = new GitSwitchBranchCommandStub({ logger });

    commandStub.createChildProcess.mockImplementation(async (cmd) => {
      if (cmd === `git rev-parse --verify refs/heads/${CMD_CONFIG.branchName}`) {
        throw new Error();
      }

      return {
        stdout: "",
        stderr: "",
        childProcess: Stubs.childProcess(),
      };
    });

    await commandStub.do();

    await commandStub.undo();

    expect(logger.info).toBeCalledWith(`Deleted branch '${CMD_CONFIG.branchName}'`);

    expect(commandStub.createChildProcess).toBeCalledWith(`git branch -D ${CMD_CONFIG.branchName}`, {
      cwd: CMD_CONFIG.workingDirectory,

    });
  });

  test("undo switches to initial branch", async () => {
    const logger = new Stubs.LoggerStub();
    const initialBranchName = Date.now().toString();
    const commandStub = new GitSwitchBranchCommandStub({ logger });

    commandStub.createChildProcess.mockImplementation(async (cmd) => {
      if (cmd === "git rev-parse --abbrev-ref HEAD") {
        return {
          stderr: "",
          stdout: initialBranchName,
          childProcess: Stubs.childProcess(),
        };
      }

      return {
        stdout: "",
        stderr: "",
        childProcess: Stubs.childProcess(),
      };
    });

    await commandStub.do();

    await commandStub.undo();

    expect(logger.info).toBeCalledWith(`Switched to branch '${initialBranchName}'`);

    expect(commandStub.createChildProcess).toBeCalledWith(`git switch ${initialBranchName}`, {
      cwd: CMD_CONFIG.workingDirectory,

    });
  });

  test("branch is created and switched when branch does not exists", async () => {
    const commandStub = new GitSwitchBranchCommandStub();

    commandStub.createChildProcess.mockImplementation(async (cmd) => {
      if (cmd === `git rev-parse --verify refs/heads/${CMD_CONFIG.branchName}`) {
        throw new Error();
      }

      if (cmd === "git rev-parse --abbrev-ref HEAD") {
        return {
          stderr: "",
          stdout: Date.now().toString(),
          childProcess: Stubs.childProcess(),
        };
      }

      return {
        stderr: "",
        stdout: "",
        childProcess: Stubs.childProcess(),
      };
    });

    await commandStub.do();

    expect(commandStub.createChildProcess).toBeCalledWith(`git switch -c ${CMD_CONFIG.branchName}`, {
      cwd: CMD_CONFIG.workingDirectory,

    });
  });
});
