import to from "await-to-js";
import { vitest, describe, test, expect, beforeEach } from "vitest";

import { Stubs } from "../stubs";
import { Commands } from "../../src";

const execute = vitest.fn();

const LOGGER = new Stubs.LoggerStub();

class GitPushBranchCommandStub extends Commands.GitPushBranchCommand {
  private static readonly CMD_CONFIG: Commands.GitPushBranchCommandConfig = {
    remote: "custom-remote",
    logger: LOGGER,
    workingDirectory: "/home/bla/bla",
    branchName: "version-123-generated-files",
  };

  constructor(config?: Partial<Commands.GitPushBranchCommandConfig>) {
    super(Object.assign({}, GitPushBranchCommandStub.CMD_CONFIG, config));
  }
}

vitest.mock("execa", () => {
  return {
    default: async (...args) => {
      return execute(...args);
    }
  };
});

describe("perform git push", () => {
  beforeEach(() => {
    execute.mockImplementation(() => {
      return {
        stdout: "",
      };
    });
  });

  test("undo warns when branch was pushed", async () => {
    const expectedRemote = "some-remote";
    const expectedBranchName = "version-generated-files";
    const expectedWorkingDirectory = "/bla/bla/t";
    const commandStub = new GitPushBranchCommandStub({
      logger: LOGGER,
      remote: expectedRemote,
      branchName: expectedBranchName,
      workingDirectory: expectedWorkingDirectory,
    });

    await commandStub.do();

    execute.mockClear();

    await commandStub.undo();

    expect(execute).not.toBeCalled();

    expect(LOGGER.warn).toBeCalledWith(`Cannot un-push remote branch '${expectedBranchName}'`);
  });

  test("execution fails when remote branch exists", async () => {
    const expectedRemote = "custom-remote";
    const expectedBranchName = "version-x-generated-files";
    const commandStub = new GitPushBranchCommandStub({
      logger: LOGGER,

      remote: expectedRemote,
      branchName: expectedBranchName,
    });
    const expectedError = new Error(`Remote '${expectedRemote}' already has a branch named '${expectedBranchName}'`);

    execute.mockClear().mockImplementationOnce(() => {
      return {
        stdout: "branch exists",
      };
    });

    expect((await to(commandStub.do()))[0]).toEqual(expectedError);
  });

  test("undo does not delete remote branch when it was not created", async () => {
    const expectedRemote = "some-remote";
    const expectedBranchName = "version-generated-files";
    const expectedWorkingDirectory = "/bla/bla/t";
    const commandStub = new GitPushBranchCommandStub({
      remote: expectedRemote,
      branchName: expectedBranchName,
      workingDirectory: expectedWorkingDirectory,
      failWhenRemoteBranchExists: true,
    });

    execute.mockClear().mockImplementation((_, args: string[]) => {
      return Promise.resolve({
        stdout: args[0] === "ls-remote" ? "branch exists" : "",
      });
    });

    await commandStub.do().catch(() => {
      return undefined;
    });
    await commandStub.undo();

    expect(execute).not.toBeCalledWith("git", ["push", expectedRemote, "--delete", expectedBranchName], {
      cwd: expectedWorkingDirectory,
    });
  });
});
