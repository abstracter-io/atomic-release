import to from "await-to-js";

import { spiedLogger } from "../../stubs/spied-logger";
import { GitTagCommand, GitTagCommandOptions } from "../../../commands";

const execute = jest.fn();
const logger = spiedLogger();

jest.mock("execa", () => {
  return async (...args) => {
    return execute(...args);
  };
});

class GitTagCommandStub extends GitTagCommand {
  public static readonly DEFAULT_OPTIONS: GitTagCommandOptions = {
    logger,
    remote: Date.now().toString(),
    workingDirectory: "/home/super.mario",
    name: "version-123-generated-files",
  };

  constructor(options?: Partial<GitTagCommandOptions>) {
    super(Object.assign({}, GitTagCommandStub.DEFAULT_OPTIONS, options));
  }
}

describe("create a git tag locally/remotely", () => {
  const expected = GitTagCommandStub.DEFAULT_OPTIONS;

  const localTagExistsParameters = [
    "git",
    ["tag", "--list", expected.name],
    {
      cwd: expected.workingDirectory,
    },
  ];

  const remoteTagExistsParameters = [
    "git",
    ["ls-remote", expected.remote, `refs/tags/${expected.name}`],
    {
      cwd: expected.workingDirectory,
    },
  ];

  const createLocalTagParameters = [
    "git",
    ["tag", expected.name],
    {
      cwd: expected.workingDirectory,
    },
  ];

  const createRemoteTagParameters = [
    "git",
    ["push", expected.remote, `refs/tags/${expected.name}`],
    {
      cwd: expected.workingDirectory,
    },
  ];

  const deleteLocalTagParameters = [
    "git",
    ["tag", "--delete", expected.name],
    {
      cwd: expected.workingDirectory,
    },
  ];

  const deleteRemoteTagParameters = [
    "git",
    ["push", expected.remote, "--delete", `refs/tags/${expected.name}`],
    {
      cwd: expected.workingDirectory,
    },
  ];

  beforeEach(() => {
    execute.mockImplementation((_, args) => {
      return Promise.resolve({
        stdout: "",
        exitCode: args[0] === "show-ref" ? 1 : 0,
      });
    });
  });

  test("tag is created locally", async () => {
    const commandStub = new GitTagCommandStub();

    await commandStub.do();

    expect(execute).toBeCalledWith(...createLocalTagParameters);
    expect(logger.info).toBeCalledWith(`Created a local tag '${expected.name}'`);
  });

  test("tag is pushed to remote", async () => {
    const commandStub = new GitTagCommandStub();

    await commandStub.do();

    expect(execute).toHaveBeenNthCalledWith(3, ...createLocalTagParameters);

    expect(execute).toHaveBeenNthCalledWith(4, ...createRemoteTagParameters);

    expect(logger.info).toBeCalledWith(`Pushed tag '${expected.name}' to remote '${expected.remote}'`);
  });

  test("tag is not created when local tag exists", async () => {
    const commandStub = new GitTagCommandStub();

    execute.mockClear().mockImplementation(async (_, args) => {
      return {
        stdout: args[0] === "ls-remote" ? "" : "v2",
        exitCode: 0,
      };
    });

    const [error] = await to(commandStub.do());

    expect(execute).toBeCalledWith(...localTagExistsParameters);
    expect(execute).not.toBeCalledWith(...createLocalTagParameters);
    expect(error).toEqual(new Error(`A local tag named '${expected.name}' already exists`));
  });

  test("tag is not created when remote tag exists", async () => {
    const commandStub = new GitTagCommandStub();

    execute.mockClear().mockImplementation((_, args) => {
      return Promise.resolve({
        stdout: args[0] === "ls-remote" ? "exists" : "",
      });
    });

    const [error] = await to(commandStub.do());

    expect(execute).toBeCalledWith(...remoteTagExistsParameters);

    expect(execute).not.toBeCalledWith(...createRemoteTagParameters);

    expect(error).toEqual(new Error(`A tag named '${expected.name}' already exists in remote '${expected.remote}'`));
  });

  test("undo deletes local tag when it was created", async () => {
    const commandStub = new GitTagCommandStub();

    await commandStub.do();
    await commandStub.undo();

    expect(execute).toBeCalledWith(...deleteLocalTagParameters);
    expect(logger.info).toBeCalledWith(`Deleted local tag '${expected.name}'`);
  });

  test("undo deletes remote tag when it was created", async () => {
    const commandStub = new GitTagCommandStub();

    await commandStub.do();
    await commandStub.undo();

    expect(execute).toBeCalledWith(...deleteRemoteTagParameters);
  });

  test("undo deletes local tag before deleting remote tag", async () => {
    const commandStub = new GitTagCommandStub();

    await commandStub.do();
    await commandStub.undo();

    const undoCalls = execute.mock.calls.slice(-2);

    expect(undoCalls[0]).toEqual(deleteLocalTagParameters);
    expect(undoCalls[1]).toEqual(deleteRemoteTagParameters);
  });

  test("undo deletes remote tag when deleting local tag fail", async () => {
    const commandStub = new GitTagCommandStub();

    execute.mockClear().mockImplementation(async (_, args) => {
      if (args.join(" ") === (deleteLocalTagParameters[1] as string[]).join(" ")) {
        throw new Error();
      }

      return {
        exitCode: 0,
        stdout: "",
      };
    });

    await commandStub.do();
    await commandStub.undo();

    expect(execute).toBeCalledWith(...deleteRemoteTagParameters);
    expect(logger.error).toBeCalledWith(new Error(`Failed to delete local tag '${expected.name}'`));
  });

  test("remote tag is not created when creating local tag fails", async () => {
    const expectedError = new Error();
    const commandStub = new GitTagCommandStub();

    execute.mockClear().mockImplementation(async (_, args) => {
      if (args.join(" ") === `tag ${expected.name}`) {
        throw expectedError;
      }

      return {
        stdout: "",
        exitCode: 0,
      };
    });

    const [error] = await to(commandStub.do());
    await commandStub.undo();

    expect(error).toEqual(expectedError);
    expect(execute).toBeCalledWith(...createLocalTagParameters);
    expect(execute).not.toBeCalledWith(...createRemoteTagParameters);
  });

  test("undo does not deletes local tag when it was not created", async () => {
    const commandStub = new GitTagCommandStub();

    execute.mockClear().mockImplementation(async (_, args) => {
      if (args.join(" ") === `tag ${expected.name}`) {
        throw new Error();
      }

      return {
        exitCode: 0,
        stdout: "",
      };
    });

    await to(commandStub.do());
    await commandStub.undo();

    expect(execute).not.toBeCalledWith(...deleteLocalTagParameters);
  });

  test("undo does not deletes remote tag when it was not created", async () => {
    const commandStub = new GitTagCommandStub();

    execute.mockClear().mockImplementation(async (_, args) => {
      if (args.join(" ") === `push ${expected.remote} refs/tags/${expected.name}`) {
        throw new Error();
      }

      return {
        exitCode: 0,
        stdout: "",
      };
    });

    await to(commandStub.do());

    await commandStub.undo();

    await expect(execute).not.toBeCalledWith(...deleteRemoteTagParameters);
  });
});
