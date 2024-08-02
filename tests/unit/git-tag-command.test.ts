import to from "await-to-js";
import { ChildProcess } from "node:child_process";
import { vitest, describe, expect, test } from "vitest";

import { Stubs } from "../stubs";
import { Commands } from "../../src";

const CMD_CONFIG: Commands.GitTagCommandConfig = {
  logger: Stubs.NoopLogger.INSTANCE,
  remote: Date.now().toString(),
  workingDirectory: "/home/super.mario",
  name: "version-123-generated-files",
};

class GitTagCommandStub extends Commands.GitTagCommand {
  constructor(config?: Partial<Commands.GitTagCommandConfig>) {
    super({ ...CMD_CONFIG, ...config });
  }

  public createChildProcess = vitest.fn(async (_args: any) => {
    return {
      stdout: "",
      stderr: "",
      childProcess: Stubs.childProcess(),
    };
  })
}

describe("create a git tag locally/remotely", () => {
  const localTagExistsParameters = `git tag --list ${CMD_CONFIG.name}`;

  const remoteTagExistsParameters = `git ls-remote ${CMD_CONFIG.remote} refs/tags/${CMD_CONFIG.name}`;

  const createLocalTagParameters = `git tag ${CMD_CONFIG.name}`;

  const createRemoteTagParameters = `git push ${CMD_CONFIG.remote} refs/tags/${CMD_CONFIG.name}`;

  const deleteLocalTagParameters = `git tag --delete ${CMD_CONFIG.name}`;

  const deleteRemoteTagParameters = `git push ${CMD_CONFIG.remote} --delete refs/tags/${CMD_CONFIG.name}`;

  test("tag is created locally", async () => {
    const logger = new Stubs.LoggerStub();
    const commandStub = new GitTagCommandStub({
      logger
    });

    await commandStub.do();

    expect(logger.info).toBeCalledWith(`Created a local tag '${CMD_CONFIG.name}'`);

    expect(commandStub.createChildProcess).toBeCalledWith(createLocalTagParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });
  });

  test("tag is pushed to remote", async () => {
    const logger = new Stubs.LoggerStub();
    const commandStub = new GitTagCommandStub({ logger });

    await commandStub.do();

    expect(commandStub.createChildProcess).toBeCalledWith(createLocalTagParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(commandStub.createChildProcess).toBeCalledWith(createRemoteTagParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(logger.info).toBeCalledWith(`Pushed tag '${CMD_CONFIG.name}' to remote '${CMD_CONFIG.remote}'`);
  });

  test("tag is not created when local tag exists", async () => {
    const commandStub = new GitTagCommandStub();

    commandStub.createChildProcess.mockImplementation(async (cmd) => {
      return {
        stderr: '',
        stdout: cmd.includes("ls-remote") ? "" : "v2",
        exitCode: 0,
        childProcess: Stubs.childProcess(),
      };
    });

    const [error] = await to(commandStub.do());

    expect(commandStub.createChildProcess).toBeCalledWith(localTagExistsParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(commandStub.createChildProcess).not.toBeCalledWith(createLocalTagParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(error).toEqual(new Error(`A local tag named '${CMD_CONFIG.name}' already exists`));
  });

  test("tag is not created when remote tag exists", async () => {
    const commandStub = new GitTagCommandStub();

    commandStub.createChildProcess.mockImplementation(async (cmd) => {
      return {
        stderr: "",
        stdout: cmd.includes("ls-remote") ? "exists" : "",
        childProcess: Stubs.childProcess(),
      };
    });

    const [error] = await to(commandStub.do());

    expect(commandStub.createChildProcess).toBeCalledWith(remoteTagExistsParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(commandStub.createChildProcess).not.toBeCalledWith(createRemoteTagParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(error).toEqual(new Error(`A tag named '${CMD_CONFIG.name}' already exists in remote '${CMD_CONFIG.remote}'`));
  });

  test("undo deletes local tag when it was created", async () => {
    const logger = new Stubs.LoggerStub();
    const commandStub = new GitTagCommandStub({ logger });

    await commandStub.do();

    await commandStub.undo();

    expect(commandStub.createChildProcess).toBeCalledWith(deleteLocalTagParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(logger.info).toBeCalledWith(`Deleted local tag '${CMD_CONFIG.name}'`);
  });

  test("undo deletes remote tag when it was created", async () => {
    const commandStub = new GitTagCommandStub();

    await commandStub.do();

    await commandStub.undo();

    expect(commandStub.createChildProcess).toBeCalledWith(deleteRemoteTagParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });
  });

  test("undo deletes local tag before deleting remote tag", async () => {
    const commandStub = new GitTagCommandStub();

    await commandStub.do();

    await commandStub.undo();

    expect(commandStub.createChildProcess).toBeCalledWith(deleteLocalTagParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(commandStub.createChildProcess).toBeCalledWith(deleteRemoteTagParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });
  });

  test("undo deletes remote tag when deleting local tag failed", async () => {
    const logger = new Stubs.LoggerStub();
    const commandStub = new GitTagCommandStub({ logger });

    commandStub.createChildProcess.mockImplementation(async (cmd) => {
      if (cmd !== deleteLocalTagParameters) {
        return {
          stdout: "",
          stderr: "",
          childProcess: Stubs.childProcess(),
        };
      }

      throw new Error();
    });

    await commandStub.do();

    await commandStub.undo();

    expect(commandStub.createChildProcess).toBeCalledWith(deleteRemoteTagParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(logger.error).toBeCalledWith(new Error(`Failed to delete local tag '${CMD_CONFIG.name}'`));
  });

  test("remote tag is not created when creating local tag fails", async () => {
    const expectedError = new Error();
    const commandStub = new GitTagCommandStub();

    commandStub.createChildProcess.mockImplementation(async (cmd) => {
      if (cmd === createLocalTagParameters) {
        throw expectedError;
      }

      return {
        stderr: "",
        stdout: "",
        childProcess: new ChildProcess(),
      };
    });

    const error = await commandStub.do().catch(e => e);

    await commandStub.undo();

    expect(error).toEqual(expectedError);

    expect(commandStub.createChildProcess).toBeCalledWith(createLocalTagParameters, {

      cwd: CMD_CONFIG.workingDirectory,
    });

    expect(commandStub.createChildProcess).not.toBeCalledWith(createRemoteTagParameters, expect.anything());
  });

  test("undo does not deletes local tag when it was not created", async () => {
    const commandStub = new GitTagCommandStub();

    commandStub.createChildProcess.mockImplementation(async (cmd) => {
      if (cmd.includes(`tag ${CMD_CONFIG.name}`)) {
        throw new Error();
      }

      return {
        stderr: "",
        stdout: "",
        childProcess: new ChildProcess(),
      };
    });

    await to(commandStub.do());

    await commandStub.undo();

    expect(commandStub.createChildProcess).not.toBeCalledWith(deleteLocalTagParameters);
  });

  test("undo does not deletes remote tag when it was not created", async () => {
    const commandStub = new GitTagCommandStub();

    commandStub.createChildProcess.mockImplementation(async (cmd) => {
      if (cmd.join(`push ${CMD_CONFIG.remote} refs/tags/${CMD_CONFIG.name}`)) {
        throw new Error();
      }

      return {
        stdout: "",
        stderr: "",
        childProcess: new ChildProcess(),
      };
    });

    await to(commandStub.do());

    await commandStub.undo();

    expect(commandStub.createChildProcess).not.toBeCalledWith(deleteRemoteTagParameters);
  });
});
