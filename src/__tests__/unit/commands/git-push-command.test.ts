import to from "await-to-js";

import { spiedLogger } from "../../stubs/spied-logger";
import { GitPushBranchCommand, GitPushBranchCommandOptions } from "../../../commands";

const execute = jest.fn();
const logger = spiedLogger();

jest.mock("execa", () => {
  return async (...args) => {
    return execute(...args);
  };
});

class GitPushBranchCommandStub extends GitPushBranchCommand {
  private static readonly DEFAULT_OPTIONS: GitPushBranchCommandOptions = {
    remote: "custom-remote",
    logger: spiedLogger(),
    workingDirectory: "/home/bla/bla",
    branchName: "version-123-generated-files",
  };

  constructor(options?: Partial<GitPushBranchCommandOptions>) {
    super(Object.assign({}, GitPushBranchCommandStub.DEFAULT_OPTIONS, options));
  }
}

describe("perform git push", () => {
  beforeEach(() => {
    execute.mockImplementation(() => {
      return {
        stdout: "",
      };
    });
  });

  test("remote branch is deleted when created", async () => {
    const expectedRemote = "some-remote";
    const expectedBranchName = "version-generated-files";
    const expectedWorkingDirectory = "/bla/bla/t";
    const commandStub = new GitPushBranchCommandStub({
      remote: expectedRemote,
      branchName: expectedBranchName,
      workingDirectory: expectedWorkingDirectory,
    });

    await commandStub.do();
    await commandStub.undo();

    expect(execute).toBeCalledWith("git", ["push", expectedRemote, "--delete", expectedBranchName], {
      cwd: expectedWorkingDirectory,
    });
  });

  test("execution fails when remote branch exists", async () => {
    const expectedRemote = "custom-remote";
    const expectedBranchName = "version-x-generated-files";
    const commandStub = new GitPushBranchCommandStub({
      logger,

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
