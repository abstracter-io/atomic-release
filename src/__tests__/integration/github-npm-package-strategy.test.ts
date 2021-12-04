import * as Commands from "../../commands";
import { Release } from "../../ports/release";
import { GithubNpmPackageStrategy } from "../../strategies";
import { GitExecaClient } from "../../adapters/git-execa-client";
import { gitSemanticRelease } from "../../adapters/git-semantic-release";

import { spiedLogger } from "../stubs/spied-logger";

const LOGGER = spiedLogger();
const HASH = "c658ea3e060490dced90dfb34c018d88b8e797f9";
const STABLE_BRANCH_NAME = "main";
const PRE_RELEASE_BRANCH_NAME = "beta";
const WORKING_DIRECTORY = "/this/is/sparta";
const ANY_LOGGER = {
  debug: expect.any(Function),
  error: expect.any(Function),
  info: expect.any(Function),
  warn: expect.any(Function),
};

class GitClientStub extends GitExecaClient {
  constructor() {
    super({ workingDirectory: process.cwd() });
  }

  cliVersion = jest.fn();
  refHash = jest.fn();
  refName = jest.fn();
  commits = jest.fn();
  mergedTags = jest.fn();
  remoteTagHash = jest.fn();
  remoteBranchHash = jest.fn();
}

const npmStrategyOptions = () => {
  return {
    logger: LOGGER,

    workingDirectory: WORKING_DIRECTORY,

    github: {
      repo: "123",
      owner: "456",
      personalAccessToken: "789",
    },

    isStable: false,

    branchConfig: {
      [STABLE_BRANCH_NAME]: {
        isStableGithubRelease: true,
        npmRegistryDistTag: "latest",
      },

      [PRE_RELEASE_BRANCH_NAME]: {
        isStableGithubRelease: false,
        npmRegistryDistTag: PRE_RELEASE_BRANCH_NAME,
      },
    },
  };
};

const gitSemanticReleaseOptions = () => {
  return {
    logger: LOGGER,
    stableBranchName: STABLE_BRANCH_NAME,
    preReleaseBranches: {
      [PRE_RELEASE_BRANCH_NAME]: PRE_RELEASE_BRANCH_NAME,
    },
    conventionalChangelogWriterContext: {
      owner: "t",
      repository: "t",
      host: "https://github.com",
      repoUrl: "https://github.com/t/t",
    },
  };
};

const commandOptions = (methodName: string) => {
  return async (strategy): Promise<void> => {
    const spy = jest.spyOn(strategy, methodName);

    await strategy.getCommands();

    return await spy.mock.results[0].value;
  };
};

describe("npm package strategy", () => {
  let release: Release;
  let strategy: GithubNpmPackageStrategy;
  let gitClient: jest.Mocked<GitExecaClient>;

  beforeEach(async () => {
    gitClient = new GitClientStub() as unknown as jest.Mocked<GitExecaClient>;

    release = await gitSemanticRelease({
      gitClient,
      ...gitSemanticReleaseOptions(),
    });

    strategy = new GithubNpmPackageStrategy({
      release,
      gitClient,
      ...npmStrategyOptions(),
    });

    gitClient.cliVersion.mockImplementation(async () => "2.7.0");

    gitClient.refHash.mockImplementation(async () => HASH);

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          subject: "feat: ...",
          body: "",
          notes: "",
          author: {
            name: "",
            email: "",
          },
          committer: {
            name: "",
            email: "",
          },
          tags: [],
          hash: HASH,
          committedTimestamp: Date.now(),
        },
      ];
    });

    gitClient.refName.mockImplementation(async () => PRE_RELEASE_BRANCH_NAME);

    gitClient.mergedTags.mockImplementation(async () => {
      const name = "v0.1.0";
      const hash = HASH;

      return [{ name, hash }];
    });

    gitClient.remoteTagHash.mockImplementation(async () => null);

    gitClient.remoteBranchHash.mockImplementation(async () => HASH);
  });

  test("strategy does not execute with no commands", async () => {
    const executeCommands = jest.fn();
    const strategy = new GithubNpmPackageStrategy({
      ...npmStrategyOptions(),
      release,
      gitClient,
    });

    // @ts-expect-error private method can be spied
    jest.spyOn(strategy, "executeCommands").mockImplementation(executeCommands);

    // @ts-expect-error protected method can be spied
    jest.spyOn(strategy, "getCommands").mockImplementation(async () => []);

    await strategy.run();

    expect(executeCommands).not.toBeCalled();
    expect(LOGGER.warn).toBeCalledWith(`Strategy ${strategy.constructor.name} has no commands`);
  });

  test("strategy executes commands in specific order", async () => {
    const executeCommands = jest.fn();
    const strategy = new GithubNpmPackageStrategy({
      ...npmStrategyOptions(),
      release,
      gitClient,
    });

    // @ts-expect-error protected method can be spied
    jest.spyOn(strategy, "executeCommands").mockImplementation(executeCommands);

    await strategy.run();

    expect(executeCommands).toBeCalledWith([
      expect.any(Commands.GitTagCommand),
      expect.any(Commands.GitSwitchBranchCommand),
      expect.any(Commands.FileWriterCommand),
      expect.any(Commands.NpmBumpPackageVersionCommand),
      expect.any(Commands.GitCommitCommand),
      expect.any(Commands.GitPushBranchCommand),
      expect.any(Commands.GitSwitchBranchCommand),
      expect.any(Commands.GithubCreatePullRequestCommand),
      expect.any(Commands.GithubCreateReleaseCommand),
      expect.any(Commands.GithubCreateIssueCommentsCommand),
      expect.any(Commands.NpmPublishPackageCommand),
    ]);
  });

  test("strategy sets exit code to 1 when command fails", async () => {
    const strategy = new GithubNpmPackageStrategy({
      ...npmStrategyOptions(),
      release,
      gitClient,
    });
    const expectedError = new Error("Error");

    // @ts-expect-error protected method can be spied
    jest.spyOn(strategy, "getCommands").mockImplementationOnce(() => {
      return [
        {
          getName() {
            return "Dummy Command";
          },

          do() {
            return Promise.reject(expectedError);
          },

          undo() {
            return Promise.resolve();
          },
        },
      ];
    });

    expect(await strategy.run().catch((e) => e)).toStrictEqual(expectedError);

    expect(process.exitCode).toStrictEqual(1);
  });

  test("strategy does not run when version has not changed", async () => {
    // @ts-expect-error protected method can be spied
    const shouldRunSpy = jest.spyOn(strategy, "shouldRun");

    gitClient.commits.mockImplementation(async () => []);

    await strategy.run();

    expect(await shouldRunSpy.mock.results[0].value).toStrictEqual(false);
  });

  test("strategy does not run when branch is not a release branch", async () => {
    const isReleaseBranch = jest.fn((_branchName) => false);
    const strategy = new GithubNpmPackageStrategy({
      ...npmStrategyOptions(),
      isReleaseBranch,
      release,
      gitClient,
    });

    // @ts-expect-error protected method can be spied
    const shouldRunSpy = jest.spyOn(strategy, "shouldRun");

    gitClient.refName.mockImplementation(async () => STABLE_BRANCH_NAME);

    gitClient.remoteBranchHash.mockImplementation(async () => {
      return "1";
    });

    await strategy.run();

    expect(isReleaseBranch).toHaveBeenCalledWith(STABLE_BRANCH_NAME);

    expect(await shouldRunSpy.mock.results[0].value).toStrictEqual(false);

    expect(LOGGER.info).toBeCalledWith(`Branch '${STABLE_BRANCH_NAME}' is not a release branch`);
  });

  test("strategy does not write changelog when changelog is empty", async () => {
    const executeCommands = jest.fn();

    jest.spyOn(release, "getChangelog").mockImplementationOnce(async () => null);
    jest.spyOn(release, "getChangelogByVersion").mockImplementationOnce(async () => null);

    // @ts-expect-error protected method can be spied
    jest.spyOn(strategy, "executeCommands").mockImplementation(executeCommands);

    await strategy.run();

    expect(executeCommands).toBeCalledWith([
      expect.any(Commands.GitTagCommand),
      expect.any(Commands.GitSwitchBranchCommand),
      expect.any(Commands.NpmBumpPackageVersionCommand),
      expect.any(Commands.GitCommitCommand),
      expect.any(Commands.GitPushBranchCommand),
      expect.any(Commands.GitSwitchBranchCommand),
      expect.any(Commands.GithubCreatePullRequestCommand),
      expect.any(Commands.GithubCreateReleaseCommand),
      expect.any(Commands.GithubCreateIssueCommentsCommand),
      expect.any(Commands.NpmPublishPackageCommand),
    ]);
  });

  test("strategy does not run when remote/local branch hash differ", async () => {
    const strategy = new GithubNpmPackageStrategy({
      ...npmStrategyOptions(),
      release,
      gitClient,
    });

    // @ts-expect-error protected method can be spied
    const getCommandsSpy = jest.spyOn(strategy, "getCommands");

    gitClient.remoteBranchHash.mockImplementation(async () => {
      return "1";
    });

    await strategy.run();

    expect(getCommandsSpy).not.toBeCalled();
    expect(LOGGER.info).toBeCalledWith(`Local branch hash is not the same as its remote counterpart`);
  });

  describe("tag command options", () => {
    const getCommandOptions = commandOptions("tagOptions");

    test("with a custom remote", async () => {
      const expectedRemoteName = "origin2";
      const strategy = new GithubNpmPackageStrategy({
        ...npmStrategyOptions(),
        release,
        gitClient,
        remote: expectedRemoteName,
      });

      expect(await getCommandOptions(strategy)).toStrictEqual({
        logger: ANY_LOGGER,

        name: `v${await release.getNextVersion()}`,

        remote: expectedRemoteName,

        workingDirectory: WORKING_DIRECTORY,
      });
    });

    test("without a custom remote", async () => {
      expect(await getCommandOptions(strategy)).toStrictEqual({
        logger: ANY_LOGGER,

        name: `v${await release.getNextVersion()}`,

        remote: "origin",

        workingDirectory: WORKING_DIRECTORY,
      });
    });
  });

  describe("commit changelog command options", () => {
    const getCommandOptions = commandOptions("commitOptions");

    test("with git actor", async () => {
      const expectedActor = "bot <bot@email.com>";
      const strategy = new GithubNpmPackageStrategy({
        ...npmStrategyOptions(),
        release,
        gitClient,
        gitActor: expectedActor,
      });
      const expected = expect.objectContaining({
        actor: expectedActor,
      });

      expect(await getCommandOptions(strategy)).toStrictEqual(expected);
    });

    test("is using strategy options", async () => {
      expect(await getCommandOptions(strategy)).toStrictEqual({
        logger: ANY_LOGGER,
        actor: undefined,
        workingDirectory: WORKING_DIRECTORY,
        commitMessage: `docs(changelog): Adding version ${await release.getNextVersion()} change log`,
        filePaths: new Set([`${WORKING_DIRECTORY}/CHANGELOG.md`]),
      });
    });

    test("working directory is process.cwd() when undefined", async () => {
      const strategy = new GithubNpmPackageStrategy({
        ...npmStrategyOptions(),
        release,
        gitClient,
        workingDirectory: undefined,
      });
      const expected = expect.objectContaining({
        workingDirectory: process.cwd(),
        filePaths: new Set([`${process.cwd()}/CHANGELOG.md`]),
      });

      expect(await getCommandOptions(strategy)).toStrictEqual(expected);
    });
  });

  describe("create temp branch command options", () => {
    const getCommandOptions = commandOptions("switchToTempBranchOptions");

    test("is using strategy options", async () => {
      expect(await getCommandOptions(strategy)).toStrictEqual({
        logger: ANY_LOGGER,

        branchName: `${await release.getNextVersion()}`,

        workingDirectory: WORKING_DIRECTORY,
      });
    });
  });

  describe("publish npm package command options", () => {
    const getCommandOptions = commandOptions("npmPublishOptions");

    test("with custom package root", async () => {
      const packageRoot = "/a/b/c";
      const strategy = new GithubNpmPackageStrategy({
        ...npmStrategyOptions(),
        release,
        gitClient,
        packageRoot,
        workingDirectory: WORKING_DIRECTORY,
      });

      expect(await getCommandOptions(strategy)).toStrictEqual({
        logger: ANY_LOGGER,
        tag: "beta",
        workingDirectory: packageRoot,
      });
    });

    test("working directory is process.cwd() when undefined", async () => {
      const strategy = new GithubNpmPackageStrategy({
        ...npmStrategyOptions(),
        release,
        gitClient,
        workingDirectory: undefined,
      });
      const expected = expect.objectContaining({
        workingDirectory: process.cwd(),
      });

      expect(await getCommandOptions(strategy)).toStrictEqual(expected);
    });

    test("changelog file path when working directory is undefined", async () => {
      const expectedDistTag = "unstable";
      const strategy = new GithubNpmPackageStrategy({
        ...npmStrategyOptions(),
        release,
        gitClient,

        branchConfig: {
          [PRE_RELEASE_BRANCH_NAME]: {
            isStableGithubRelease: false,
            npmRegistryDistTag: expectedDistTag,
          },
        },
      });

      expect(await getCommandOptions(strategy)).toStrictEqual({
        logger: ANY_LOGGER,
        tag: expectedDistTag,
        workingDirectory: WORKING_DIRECTORY,
      });
    });
  });

  describe("changelog file writing command options", () => {
    const getCommandOptions = commandOptions("writeChangelogOptions");

    test("changelog file path when working directory is undefined", async () => {
      const strategy = new GithubNpmPackageStrategy({
        ...npmStrategyOptions(),
        release,
        gitClient,
        workingDirectory: undefined,
      });
      const expected = expect.objectContaining({
        absoluteFilePath: `${process.cwd()}/CHANGELOG.md`,
      });

      expect(await getCommandOptions(strategy)).toStrictEqual(expected);
    });

    test("changelog content is next version only when 'regenerateChangelog' is false", async () => {
      const strategy = new GithubNpmPackageStrategy({
        ...npmStrategyOptions(),
        release,
        gitClient,
        regenerateChangelog: false,
      });

      expect(await getCommandOptions(strategy)).toStrictEqual({
        create: true,
        mode: "prepend",
        logger: ANY_LOGGER,
        content: await release.getChangelog(),
        absoluteFilePath: `${WORKING_DIRECTORY}/CHANGELOG.md`,
      });
    });

    test("changelog content is all versions when 'regenerateChangelog' is true/undefined", async () => {
      for (const regenerateChangelog of [undefined, true]) {
        const strategy = new GithubNpmPackageStrategy({
          ...npmStrategyOptions(),
          release,
          gitClient,
          regenerateChangelog,
        });
        const changelogs: (string | null)[] = [await release.getChangelog()];

        for (const version of await release.getVersions()) {
          changelogs.push(await release.getChangelogByVersion(version));
        }

        expect(await getCommandOptions(strategy)).toStrictEqual({
          create: true,
          mode: "replace",
          logger: ANY_LOGGER,
          content: changelogs.join("\n"),
          absoluteFilePath: `${WORKING_DIRECTORY}/CHANGELOG.md`,
        });
      }
    });

    test("changelog options is null when changelog is empty", async () => {
      jest.spyOn(release, "getChangelog").mockImplementationOnce(async () => null);
      jest.spyOn(release, "getChangelogByVersion").mockImplementationOnce(async () => null);

      expect(await getCommandOptions(strategy)).toStrictEqual(null);
    });
  });

  describe("return to initial branch command options", () => {
    const getCommandOptions = commandOptions("switchToInitialBranchOptions");

    test("is using strategy options", async () => {
      expect(await getCommandOptions(strategy)).toStrictEqual({
        logger: ANY_LOGGER,

        branchName: await gitClient.refName("HEAD"),

        workingDirectory: WORKING_DIRECTORY,
      });
    });
  });

  describe("create a github release command options", () => {
    const getCommandOptions = commandOptions("createGithubReleaseOptions");

    test("is using strategy options", async () => {
      const { github } = npmStrategyOptions();
      const nextVersion = await release.getNextVersion();
      const tagName = `v${nextVersion}`;

      expect(await getCommandOptions(strategy)).toStrictEqual({
        tagName,
        isStable: false,
        logger: ANY_LOGGER,
        body: await release.getChangelog(),
        name: `v${nextVersion}`,
        repo: github.repo,
        owner: github.owner,
        headers: {
          Authorization: `token ${github.personalAccessToken}`,
        },
      });
    });

    test("'isStable' is true when branch config 'isStableGithubRelease' is true", async () => {
      const strategy = new GithubNpmPackageStrategy({
        ...npmStrategyOptions(),
        branchConfig: {
          [PRE_RELEASE_BRANCH_NAME]: {
            isStableGithubRelease: true,
            npmRegistryDistTag: PRE_RELEASE_BRANCH_NAME,
          },
        },
        release,
        gitClient,
      });
      const expected = expect.objectContaining({
        isStable: true,
      });

      expect(await getCommandOptions(strategy)).toStrictEqual(expected);
    });

    test("'isStable' is false when branch config 'isStableGithubRelease' is undefined/false", async () => {
      for (const isStableGithubRelease of [undefined, false]) {
        const strategy = new GithubNpmPackageStrategy({
          ...npmStrategyOptions(),
          branchConfig: {
            [PRE_RELEASE_BRANCH_NAME]: {
              isStableGithubRelease,
              npmRegistryDistTag: PRE_RELEASE_BRANCH_NAME,
            },
          },
          release,
          gitClient,
        });
        const expected = expect.objectContaining({
          isStable: false,
        });

        expect(await getCommandOptions(strategy)).toStrictEqual(expected);
      }
    });
  });

  describe("push branch with changes command options", () => {
    const getCommandOptions = commandOptions("pushOptions");

    test("is using strategy options", async () => {
      expect(await getCommandOptions(strategy)).toStrictEqual({
        remote: "origin",
        logger: ANY_LOGGER,
        branchName: await release.getNextVersion(),
        workingDirectory: WORKING_DIRECTORY,
        failWhenRemoteBranchExists: true,
      });
    });

    test("working directory is process.cwd() when undefined", async () => {
      const strategy = new GithubNpmPackageStrategy({
        ...npmStrategyOptions(),
        release,
        gitClient,
        workingDirectory: undefined,
      });
      const expected = expect.objectContaining({
        workingDirectory: process.cwd(),
      });

      expect(await getCommandOptions(strategy)).toStrictEqual(expected);
    });
  });

  describe("update package.json version command options", () => {
    const getCommandOptions = commandOptions("npmBumpVersionOptions");

    test("with custom package root", async () => {
      const packageRoot = "/a/b/c";
      const strategy = new GithubNpmPackageStrategy({
        ...npmStrategyOptions(),
        release,
        gitClient,
        packageRoot,
        workingDirectory: WORKING_DIRECTORY,
      });

      expect(await getCommandOptions(strategy)).toStrictEqual({
        logger: ANY_LOGGER,
        version: await release.getNextVersion(),
        workingDirectory: packageRoot,
      });
    });

    test("next version is taken from release", async () => {
      expect(await getCommandOptions(strategy)).toStrictEqual({
        logger: ANY_LOGGER,
        version: await release.getNextVersion(),
        workingDirectory: WORKING_DIRECTORY,
      });
    });

    test("working directory is 'process.cwd()' when undefined", async () => {
      const strategy = new GithubNpmPackageStrategy({
        ...npmStrategyOptions(),
        release,
        gitClient,
        workingDirectory: undefined,
      });
      const expected = expect.objectContaining({
        workingDirectory: process.cwd(),
      });

      expect(await getCommandOptions(strategy)).toStrictEqual(expected);
    });
  });

  describe("create a github pull request command options", () => {
    const getCommandOptions = commandOptions("createGithubPullRequestOptions");

    test("is using strategy options", async () => {
      const { github } = npmStrategyOptions();
      const nextVersion = await release.getNextVersion();

      expect(await getCommandOptions(strategy)).toStrictEqual({
        logger: ANY_LOGGER,
        base: PRE_RELEASE_BRANCH_NAME,
        head: nextVersion,
        repo: github.repo,
        owner: github.owner,
        title: `Adding files affected by version ${nextVersion} release`,
        headers: {
          Authorization: `token ${github.personalAccessToken}`,
        },
      });
    });
  });

  describe("comment in github issues associated with release command options", () => {
    const getCommandOptions = commandOptions("githubIssueCommentsOptions");

    test("is using strategy options", async () => {
      const { github } = npmStrategyOptions();
      const tagName = `v${await release.getNextVersion()}`;
      const releaseURL = `https://github.com/${github.owner}/${github.repo}/releases/tag/${tagName}`;

      jest.spyOn(release, "getMentionedIssues").mockImplementation(async () => {
        return new Set(["1"]);
      });

      expect(await getCommandOptions(strategy)).toStrictEqual({
        logger: ANY_LOGGER,
        issueComments: [
          {
            issueNumber: 1,
            commentBody: `:mailbox: &nbsp; This issue was mentioned in release [${tagName}](${releaseURL})`,
          },
        ],
        repo: github.repo,
        owner: github.owner,
        headers: {
          Authorization: `token ${github.personalAccessToken}`,
        },
      });
    });
  });
});
