import { spiedLogger } from "../../stubs/spied-logger";
import { GitSwitchBranchCommand, GitSwitchCommandOptions } from "../../../commands";

const execute = jest.fn();
const logger = spiedLogger();

jest.mock("execa", () => {
  return async (...args) => {
    return execute(...args);
  };
});

class GitSwitchBranchCommandStub extends GitSwitchBranchCommand {
  public static readonly DEFAULT_OPTIONS: GitSwitchCommandOptions = {
    logger,
    workingDirectory: "/bla/bla",
    branchName: "v1.1.1",
  };

  constructor(options?: Partial<GitSwitchCommandOptions>) {
    super(Object.assign({}, GitSwitchBranchCommandStub.DEFAULT_OPTIONS, options));
  }
}

describe("switch git branch", () => {
  const expected = GitSwitchBranchCommandStub.DEFAULT_OPTIONS;

  beforeEach(() => {
    execute.mockImplementation(() => {
      return {
        stdout: "",
      };
    });
  });

  test("branch is switched", async () => {
    const commandStub = new GitSwitchBranchCommandStub();

    execute.mockImplementation((_, args) => {
      if (args.join(" ") === "rev-parse --abbrev-ref HEAD") {
        return {
          stdout: Date.now().toString(),
        };
      }

      return {
        stdout: "",
      };
    });

    await commandStub.do();

    expect(logger.info).toBeCalledWith(`Switched to branch '${expected.branchName}'`);

    expect(execute).toBeCalledWith("git", ["switch", expected.branchName], {
      cwd: expected.workingDirectory,
    });
  });

  test("branch is not switched", async () => {
    const commandStub = new GitSwitchBranchCommandStub();

    execute.mockImplementation((_, args) => {
      if (args.join(" ") === "rev-parse --abbrev-ref HEAD") {
        return {
          stdout: expected.branchName,
        };
      }

      return {
        stdout: "",
      };
    });

    await commandStub.do();

    expect(execute).not.toBeCalledWith("git", ["switch", "-c", expected.branchName], {
      cwd: expected.workingDirectory,
    });
  });

  test("missing branch name throws", async () => {
    const expectedError = new Error("Missing branch name");
    const commandStub = new GitSwitchBranchCommandStub({
      branchName: undefined,
    });
    const error = await commandStub.do().catch((e) => e);

    expect(error).toStrictEqual(expectedError);
  });

  test("undo deletes created branch", async () => {
    const commandStub = new GitSwitchBranchCommandStub();

    execute.mockImplementation((_, args) => {
      const command = args.join(" ");

      if (command === `rev-parse --verify refs/heads/${expected.branchName}`) {
        throw new Error();
      }

      return {
        stdout: "",
      };
    });

    await commandStub.do();
    await commandStub.undo();

    expect(logger.info).toBeCalledWith(`Deleted branch '${expected.branchName}'`);

    expect(execute).toBeCalledWith("git", ["branch", "-D", expected.branchName], {
      cwd: expected.workingDirectory,
    });
  });

  test("undo switches to initial branch", async () => {
    const initialBranchName = Date.now().toString();
    const commandStub = new GitSwitchBranchCommandStub();

    execute.mockImplementation((_, args) => {
      const command = args.join(" ");

      if (command === "rev-parse --abbrev-ref HEAD") {
        return {
          stdout: initialBranchName,
        };
      }

      return {
        stdout: "",
      };
    });

    await commandStub.do();
    await commandStub.undo();

    expect(logger.info).toBeCalledWith(`Switched to branch '${initialBranchName}'`);
    expect(execute).toBeCalledWith("git", ["switch", initialBranchName], {
      cwd: expected.workingDirectory,
    });
  });

  test("branch is created and switched when branch does not exists", async () => {
    const commandStub = new GitSwitchBranchCommandStub();

    execute.mockImplementation((_, args) => {
      const command = args.join(" ");

      if (command === `rev-parse --verify refs/heads/${expected.branchName}`) {
        throw new Error();
      }

      if (command === "rev-parse --abbrev-ref HEAD") {
        return {
          stdout: Date.now().toString(),
        };
      }

      return {
        stdout: "",
      };
    });

    await commandStub.do();

    expect(execute).toBeCalledWith("git", ["switch", "-c", expected.branchName], {
      cwd: expected.workingDirectory,
    });
  });
});
