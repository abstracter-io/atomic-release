import { Commit } from "../../../ports/git-client";
import { GitExecaClient } from "../../../adapters/git-execa-client";

const execute = jest.fn();

jest.mock("execa", () => {
  return async (...args) => {
    return execute(...args);
  };
});

describe("git execa client", () => {
  const expected = {
    remote: "origin2",
    workingDirectory: "/this/is/sparta",
  };
  const gitClient = new GitExecaClient(expected);

  beforeEach(() => {
    execute.mockImplementation((..._args) => {
      return Promise.resolve({
        stdout: "",
      });
    });
  });

  test("log", async () => {
    const range = "123..";
    const format = "%s";
    const delimiter = ":++:";

    execute.mockImplementation((..._args) => {
      return Promise.resolve({
        stdout: ["1", "2"].join(delimiter),
      });
    });

    expect(await gitClient.log(range, format)).toStrictEqual(["1", "2"]);

    expect(execute).toBeCalledWith("git", ["log", range, `--pretty=format:${format}${delimiter}`], {
      cwd: expected.workingDirectory,
    });
  });

  test("commits", async () => {
    const timestampInSeconds = 1633041877;
    const expectedRange = "123..";
    const commit: Commit = {
      hash: `${Date.now()}`,
      subject: "chore(scope): some text",
      body: "This is some additional description",
      notes: "123",
      tags: ["v0.1.0", "v2.1.0"],
      committedTimestamp: timestampInSeconds * 1000,
      author: {
        name: "Rick Sanchez",
        email: "rick.sanchez@show-me-what-got.com",
      },
      committer: {
        name: "Rick Sanchez",
        email: "rick.sanchez@show-me-what-got.com",
      },
    };
    const expectedFormat = ["%H", "%s", "%b", "%N", "%D", "%ct", "%an", "%ae", "%cn", "%ce"];
    const delimiter = ":<>:";

    execute.mockImplementation(() => {
      const formattedLog = [
        commit.hash,
        commit.subject,
        commit.body,
        commit.notes,
        commit.tags.map((tag) => {
          return `tag: ${tag}`;
        }).join(", "),
        commit.committedTimestamp / 1000,
        commit.author.name,
        commit.author.email,
        commit.committer.name,
        commit.committer.email,
      ];

      return Promise.resolve({
        stdout: formattedLog.join(delimiter),
      });
    });

    expect(await gitClient.commits(expectedRange)).toStrictEqual([commit]);

    expect(execute).toBeCalledWith(
      "git",
      ["log", expectedRange, `--pretty=format:${expectedFormat.join(delimiter)}:++:`],
      {
        cwd: expected.workingDirectory,
      },
    );
  });

  test("ref hash", async () => {
    const ref = "HEAD";
    const expectedHash = "123";

    execute.mockImplementation(() => {
      return Promise.resolve({
        stdout: expectedHash,
      });
    });

    expect(await gitClient.refHash(ref)).toStrictEqual(expectedHash);

    expect(execute).toBeCalledWith("git", ["rev-parse", ref], {
      cwd: expected.workingDirectory,
    });
  });

  test("ref name", async () => {
    const ref = "HEAD";
    const expectedName = "main";

    execute.mockImplementation(() => {
      return Promise.resolve({
        stdout: expectedName,
      });
    });

    expect(await gitClient.refName(ref)).toStrictEqual(expectedName);

    expect(execute).toBeCalledWith("git", ["rev-parse", "--abbrev-ref", ref], {
      cwd: expected.workingDirectory,
    });
  });

  test("cli version", async () => {
    const expectedVersion = "2.7.0";

    execute.mockImplementation(() => {
      return Promise.resolve({
        stdout: `git version ${expectedVersion}`,
      });
    });

    expect(await gitClient.cliVersion()).toStrictEqual(expectedVersion);

    expect(execute).toBeCalledWith("git", ["--version"], {
      cwd: expected.workingDirectory,
    });
  });

  test("merged tags", async () => {
    const delimiter = ":++:";
    const expectedRef = "HEAD";
    const expectedTag = {
      name: "v0.1.0",
      hash: "c658ea3e060490dced90dfb34c018d88b8e797f9",
    };

    execute.mockImplementationOnce(() => {
      return Promise.resolve({
        stdout: "git version 2.7.0",
      });
    });

    execute.mockImplementationOnce(() => {
      return Promise.resolve({
        stdout: `${expectedTag.name}${delimiter}${expectedTag.hash}`,
      });
    });

    expect(await gitClient.mergedTags(expectedRef)).toEqual([expectedTag]);

    expect(execute).toBeCalledWith(
      "git",
      ["tag", `--merged=${expectedRef}`, `--format=%(refname:strip=2)${delimiter}%(objectname)`],
      {
        cwd: expected.workingDirectory,
      },
    );
  });

  test("remote tag hash", async () => {
    const tagName = "v1.0.0";
    const expectedHash = "1234";

    execute.mockImplementation(() => {
      return Promise.resolve({
        stdout: `${expectedHash}\trefs/tags/${tagName}`,
      });
    });

    expect(await gitClient.remoteTagHash(tagName)).toStrictEqual(expectedHash);

    expect(execute).toBeCalledWith("git", ["ls-remote", expected.remote, "-t", `refs/tags/${tagName}`], {
      cwd: expected.workingDirectory,
    });
  });

  test("remote branch hash", async () => {
    const branchName = "v1.0.0";
    const expectedHash = "1234";

    execute.mockImplementation(() => {
      return Promise.resolve({
        stdout: `${expectedHash}\trefs/heads/${branchName}`,
      });
    });

    expect(await gitClient.remoteBranchHash(branchName)).toStrictEqual(expectedHash);

    expect(execute).toBeCalledWith("git", ["ls-remote", expected.remote, "-h", `refs/heads/${branchName}`], {
      cwd: expected.workingDirectory,
    });
  });

  test("remote tag hash is null", async () => {
    const tagName = "v1.0.0";

    expect(await gitClient.remoteTagHash(tagName)).toStrictEqual(null);

    expect(execute).toBeCalledWith("git", ["ls-remote", expected.remote, "-t", `refs/tags/${tagName}`], {
      cwd: expected.workingDirectory,
    });
  });

  test("remote branch hash is null", async () => {
    const tagName = "v1.0.0";

    expect(await gitClient.remoteBranchHash(tagName)).toStrictEqual(null);

    expect(execute).toBeCalledWith("git", ["ls-remote", expected.remote, "-h", `refs/heads/${tagName}`], {
      cwd: expected.workingDirectory,
    });
  });

  test("merged tags throws when cli version < 2.7.0", async () => {
    const cliVersion = "2.6.0";
    const expectedError = new Error(`Git version >= 2.7.0 is required. Found ${cliVersion}.`);

    execute.mockImplementation(() => {
      return Promise.resolve({
        stdout: `git version ${cliVersion}`,
      });
    });

    const error = await gitClient.mergedTags("HEAD").catch((e) => {
      return e;
    });

    expect(error).toEqual(expectedError);
  });
});
