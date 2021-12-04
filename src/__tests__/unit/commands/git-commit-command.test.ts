import { spiedLogger } from "../../stubs/spied-logger";
import { GitCommitCommand, GitCommitCommandOptions } from "../../../commands";

const execute = jest.fn();
const logger = spiedLogger();

jest.mock("execa", () => {
  return async (...args) => {
    return execute(...args);
  };
});

class GitCommitCommandStub extends GitCommitCommand {
  public static readonly DEFAULT_OPTIONS: GitCommitCommandOptions = {
    logger,
    workingDirectory: "/bla/bla",
    commitMessage: "There is no spoon",
    filePaths: new Set(["CHANGELOG.md", "package.json"]),
  };

  constructor(options?: Partial<GitCommitCommandOptions>) {
    super(Object.assign({}, GitCommitCommandStub.DEFAULT_OPTIONS, options));
  }
}

describe("perform a git commit", () => {
  const expected = GitCommitCommandStub.DEFAULT_OPTIONS;

  beforeEach(() => {
    execute.mockImplementation(() => {
      return {
        stdout: "",
      };
    });
  });

  test("invalid actor throws", async () => {
    const expectedError = new Error(`actor must follow "name <email>" format`);
    const commandStub = new GitCommitCommandStub({
      actor: `...`,
    });
    const error = await commandStub.do().catch((e) => e);

    expect(error).toStrictEqual(expectedError);
  });

  test("undo removes last commit", async () => {
    const expectedWorkingDir = "/home/hope/this/does/not/exists";
    const initialBranchName = "main";
    const commandStub = new GitCommitCommandStub({
      workingDirectory: expectedWorkingDir,
    });

    execute.mockClear().mockImplementation((_, args) => {
      if (args.join(" ") === "rev-parse --abbrev-ref HEAD") {
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

    expect(execute).toBeCalledWith("git", ["reset", "HEAD~"], { cwd: expectedWorkingDir });
  });

  test("files are staged & committed", async () => {
    const expectedFilePaths = ["CHANGELOG.md", "package.json"];
    const expectedCommitMessage = "There is no spoon";
    const expectedWorkingDir = "/home/hope/this/does/not/exists";
    const commandStub = new GitCommitCommandStub({
      logger,
      workingDirectory: expectedWorkingDir,
      filePaths: new Set(expectedFilePaths),
      commitMessage: expectedCommitMessage,
    });

    await commandStub.do();

    expect(logger.info).toBeCalledWith(`Committed files ${expectedFilePaths.join(", ")}`);

    expect(execute).toBeCalledWith("git", ["add", ...expectedFilePaths], { cwd: expectedWorkingDir });

    expect(execute).toBeCalledWith("git", ["commit", "-m", expectedCommitMessage], {
      env: {},
      cwd: expectedWorkingDir,
    });
  });

  test("actor is translated into git env vars", async () => {
    const name = "Bot";
    const email = "bot@email.com";
    const commandStub = new GitCommitCommandStub({
      actor: `${name} <${email}>`,
    });

    await commandStub.do();

    expect(execute).toBeCalledWith("git", ["commit", "-m", expected.commitMessage], {
      env: {
        GIT_COMMITTER_NAME: name,
        GIT_COMMITTER_EMAIL: email,
        GIT_AUTHOR_NAME: name,
        GIT_AUTHOR_EMAIL: email,
      },
      cwd: expected.workingDirectory,
    });
  });
});
