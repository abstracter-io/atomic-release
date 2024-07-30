import { vitest, describe, test, expect } from "vitest";

import { SDK } from "../../src";

const STUB_CONFIG = {
  remote: "origin2",
  workingDirectory: "/this/is/sparta",
}

class GitExecaClientStub extends SDK.GitExecaClient {
  constructor(config = STUB_CONFIG) {
    super(config);
  }

  // @ts-expect-error this is the way
  execa = vitest.fn(async (_cmd, _args, _options): Promise<any> => {
    return {
      stdout: "",
    };
  });
}

describe("git execa client", () => {
  test("log", async () => {
    const range = "123..";
    const format = "%s";
    const delimiter = ":++:";
    const gitClient = new GitExecaClientStub();

    gitClient.execa.mockImplementation(async (..._args) => {
      return {
        stdout: ["1", "2"].join(delimiter),
      };
    });

    expect(await gitClient.log(range, format)).toStrictEqual(["1", "2"]);

    expect(gitClient.execa).toBeCalledWith("git", ["log", range, `--pretty=format:${format}${delimiter}`], {
      cwd: STUB_CONFIG.workingDirectory,
    });
  });

  test("commits", async () => {
    const delimiter = ":<>:";
    const expectedRange = "123..";
    const commit: SDK.Commit = {
      hash: `${Date.now()}`,
      subject: "chore(scope): some text",
      body: "This is some additional description",
      notes: "123",
      tags: ["v0.1.0", "v2.1.0"],
      committedTimestamp: 1633041877 * 1000,
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
    const gitClient = new GitExecaClientStub();

    gitClient.execa.mockImplementation(() => {
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

    expect(gitClient.execa).toBeCalledWith(
      "git",
      ["log", expectedRange, `--pretty=format:${expectedFormat.join(delimiter)}:++:`],
      {
        cwd: STUB_CONFIG.workingDirectory,
      },
    );
  });

  test("ref hash", async () => {
    const ref = "HEAD";
    const expectedHash = "123";
    const gitClient = new GitExecaClientStub();

    gitClient.execa.mockImplementation(() => {
      return Promise.resolve({
        stdout: expectedHash,
      });
    });

    expect(await gitClient.refHash(ref)).toStrictEqual(expectedHash);

    expect(gitClient.execa).toBeCalledWith("git", ["rev-parse", ref], {
      cwd: STUB_CONFIG.workingDirectory,
    });
  });

  test("ref name", async () => {
    const ref = "HEAD";
    const expectedName = "main";
    const gitClient = new GitExecaClientStub();

    gitClient.execa.mockImplementation(() => {
      return Promise.resolve({
        stdout: expectedName,
      });
    });

    expect(await gitClient.refName(ref)).toStrictEqual(expectedName);

    expect(gitClient.execa).toBeCalledWith("git", ["rev-parse", "--abbrev-ref", ref], {
      cwd: STUB_CONFIG.workingDirectory,
    });
  });

  test("cli version", async () => {
    const expectedVersion = "2.7.0";
    const gitClient = new GitExecaClientStub();

    gitClient.execa.mockImplementation(() => {
      return Promise.resolve({
        stdout: `git version ${expectedVersion}`,
      });
    });

    expect(await gitClient.cliVersion()).toStrictEqual(expectedVersion);

    expect(gitClient.execa).toBeCalledWith("git", ["--version"], {
      cwd: STUB_CONFIG.workingDirectory,
    });
  });

  test("merged tags", async () => {
    const delimiter = ":++:";
    const expectedRef = "HEAD";
    const expectedTag = {
      name: "v0.1.0",
      hash: "c658ea3e060490dced90dfb34c018d88b8e797f9",
    };
    const gitClient = new GitExecaClientStub();

    gitClient.execa.mockImplementationOnce(() => {
      return Promise.resolve({
        stdout: "git version 2.7.0",
      });
    });

    gitClient.execa.mockImplementationOnce(() => {
      return Promise.resolve({
        stdout: `${expectedTag.name}${delimiter}${expectedTag.hash}`,
      });
    });

    expect(await gitClient.mergedTags(expectedRef)).toEqual([expectedTag]);

    expect(gitClient.execa).toBeCalledWith(
      "git",
      ["tag", `--merged=${expectedRef}`, `--format=%(refname:strip=2)${delimiter}%(objectname)`],
      {
        cwd: STUB_CONFIG.workingDirectory,
      },
    );
  });

  test("remote tag hash", async () => {
    const tagName = "v1.0.0";
    const expectedHash = "1234";
    const gitClient = new GitExecaClientStub();

    gitClient.execa.mockImplementation(() => {
      return Promise.resolve({
        stdout: `${expectedHash}\trefs/tags/${tagName}`,
      });
    });

    expect(await gitClient.remoteTagHash(tagName)).toStrictEqual(expectedHash);

    expect(gitClient.execa).toBeCalledWith("git", ["ls-remote", STUB_CONFIG.remote, "-t", `refs/tags/${tagName}`], {
      cwd: STUB_CONFIG.workingDirectory,
    });
  });

  test("remote branch hash", async () => {
    const branchName = "v1.0.0";
    const expectedHash = "1234";
    const gitClient = new GitExecaClientStub();

    gitClient.execa.mockImplementation(() => {
      return Promise.resolve({
        stdout: `${expectedHash}\trefs/heads/${branchName}`,
      });
    });

    expect(await gitClient.remoteBranchHash(branchName)).toStrictEqual(expectedHash);

    expect(gitClient.execa).toBeCalledWith("git", ["ls-remote", STUB_CONFIG.remote, "-h", `refs/heads/${branchName}`], {
      cwd: STUB_CONFIG.workingDirectory,
    });
  });

  test("remote tag hash is null", async () => {
    const tagName = "v1.0.0";
    const gitClient = new GitExecaClientStub();

    expect(await gitClient.remoteTagHash(tagName)).toStrictEqual(null);

    expect(gitClient.execa).toBeCalledWith("git", ["ls-remote", STUB_CONFIG.remote, "-t", `refs/tags/${tagName}`], {
      cwd: STUB_CONFIG.workingDirectory,
    });
  });

  test("remote branch hash is null", async () => {
    const tagName = "v1.0.0";
    const gitClient = new GitExecaClientStub();

    expect(await gitClient.remoteBranchHash(tagName)).toStrictEqual(null);

    expect(gitClient.execa).toBeCalledWith("git", ["ls-remote", STUB_CONFIG.remote, "-h", `refs/heads/${tagName}`], {
      cwd: STUB_CONFIG.workingDirectory,
    });
  });

  test("merged tags throws when cli version < 2.7.0", async () => {
    const cliVersion = "2.6.0";
    const expectedError = new Error(`Git version >= 2.7.0 is required. Found ${cliVersion}.`);
    const gitClient = new GitExecaClientStub();

    gitClient.execa.mockImplementation(() => {
      return Promise.resolve({
        stdout: `git version ${cliVersion}`,
      });
    });

    await expect(gitClient.mergedTags("HEAD")).rejects.toEqual(expectedError);
  });
});
