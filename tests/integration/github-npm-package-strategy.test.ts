import { vitest, describe, test, expect, beforeEach } from "vitest";

import { Stubs } from "../stubs";
import { SDK, Commands } from "../../src/index";
import { githubNpmPackageStrategy } from "../../src/sdk";

const LOGGER = new Stubs.LoggerStub();
const HASH = "c658ea3e060490dced90dfb34c018d88b8e797f9";
const STABLE_BRANCH_NAME = "main";
const PRE_RELEASE_BRANCH_NAME = "beta";
const WORKING_DIRECTORY = "/this/is/sparta";

const NOOP_LOGGER: SDK.Logger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

class GitClientStub extends SDK.GitExecaClient {
  constructor() {
    super({ workingDirectory: process.cwd() });
  }

  refHash = vitest.fn();
  refName = vitest.fn();
  commits = vitest.fn();
  cliVersion = vitest.fn();
  mergedTags = vitest.fn();
  remoteTagHash = vitest.fn();
  remoteBranchHash = vitest.fn();
}

const releaseConfig = () => {
  return {
    logger: LOGGER,
    stableBranchName: STABLE_BRANCH_NAME,
    preReleaseBranches: {
      [PRE_RELEASE_BRANCH_NAME]: PRE_RELEASE_BRANCH_NAME,
    },
    conventionalChangelogWriterContext: {
      owner: "owner",
      repository: "repo_name",
      host: "https://github.com",
      repoUrl: "https://github.com/owner/repo_name",
    },
  };
};

const strategyConfig = (): SDK.GithubNpmPackageStrategyConfig => {
  return {
    logger: LOGGER,
    gitActor: "Rick Sanchez <rick.sanchez@github.com>",
    gitRemote: 'origin-test',
    workingDirectory: WORKING_DIRECTORY,
    changelogFilePath: `${WORKING_DIRECTORY}/CHANGELOG.md`,
    releaseBranchNames: new Set([STABLE_BRANCH_NAME, PRE_RELEASE_BRANCH_NAME]),
    githubPersonalAccessToken: 'github-personal-access-token',
  };
};

describe("github npm package strategy", () => {
  let release: SDK.Release;
  let strategy: SDK.Strategy;
  let gitClient: GitClientStub;

  beforeEach(async () => {
    gitClient = new GitClientStub();

    release = await SDK.gitTagBasedRelease({
      gitClient,
      ...releaseConfig(),
    });

    strategy = await SDK.githubNpmPackageStrategy({
      release,
      gitClient,
      ...strategyConfig(),
    });

    gitClient.cliVersion.mockImplementation(async () => {
      return "2.7.0";
    });

    gitClient.refHash.mockImplementation(async () => {
      return HASH;
    });

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

    gitClient.refName.mockImplementation(async () => {
      return PRE_RELEASE_BRANCH_NAME;
    });

    gitClient.mergedTags.mockImplementation(async () => {
      const name = "v0.1.0";
      const hash = HASH;

      return [{ name, hash }];
    });

    gitClient.remoteTagHash.mockImplementation(async () => {
      return null;
    });

    gitClient.remoteBranchHash.mockImplementation(async () => {
      return HASH;
    });
  });

  test("commands state", async () => {
    const strategy = await SDK.githubNpmPackageStrategy({
      gitClient,
      release: await SDK.gitTagBasedRelease({
        gitClient,
        ...releaseConfig(),
        logger: NOOP_LOGGER,
      }),
      ...strategyConfig(),
      logger: NOOP_LOGGER,
    });

    // @ts-expect-error protected method
    const commands = await strategy.getCommands();

    expect(commands).toMatchSnapshot();
  });

  test("command errored", async () => {
    const expectedError = new Error("Error");

    // @ts-expect-error protected method can be spied
    vitest.spyOn(strategy, "getCommands").mockImplementationOnce(() => {
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

    await expect(strategy.run()).rejects.toStrictEqual(expectedError);

    expect(process.exitCode).toStrictEqual(1);

    expect(LOGGER.error).toBeCalledWith("Commands execution failed")
  });

  test("does not run when version has not changed", async () => {
    // @ts-expect-error protected method can be spied
    const shouldRunSpy = vitest.spyOn(strategy, "shouldRun");

    gitClient.commits.mockImplementation(async () => {
      return [];
    });

    await strategy.run();

    expect(await shouldRunSpy.mock.results[0].value).toStrictEqual(false);
  });

  test("does not run when branch is not a release branch", async () => {
    const strategy = await githubNpmPackageStrategy({
      ...strategyConfig(),
      releaseBranchNames: new Set(['test']),
      release,
      gitClient,
    });

    // @ts-expect-error protected method can be spied
    const shouldRunSpy = vitest.spyOn(strategy, "shouldRun");

    gitClient.refName.mockImplementation(async () => {
      return STABLE_BRANCH_NAME;
    });

    gitClient.remoteBranchHash.mockImplementation(async () => {
      return "1";
    });

    await strategy.run();

    expect(await shouldRunSpy.mock.results[0].value).toStrictEqual(false);

    expect(LOGGER.info).toBeCalledWith(`Branch '${STABLE_BRANCH_NAME}' is not a release branch`);
  });

  test("does not run when remote/local branch hash differ", async () => {
    const strategy = await githubNpmPackageStrategy({
      ...strategyConfig(),
      release,
      gitClient,
    });

    // @ts-expect-error protected method can be spied
    const getCommandsSpy = vitest.spyOn(strategy, "getCommands");

    gitClient.remoteBranchHash.mockImplementation(async () => {
      return "1";
    });

    await strategy.run();

    expect(getCommandsSpy).not.toBeCalled();

    expect(LOGGER.info).toBeCalledWith("Local branch hash is not the same as its remote counterpart");
  });

  test("changelog writer command is null when changelog is empty", async () => {
    vitest.spyOn(release, "getChangelog").mockImplementationOnce(async () => {
      return null;
    });

    vitest.spyOn(release, "getChangelogByVersion").mockImplementationOnce(async () => {
      return null;
    });

    // @ts-expect-error protected method can be spied
    const commands = await strategy.getCommands();

    // @ts-expect-error protected method can be spied
    vitest.spyOn(strategy, "getCommands").mockReturnValueOnce(commands)

    for (const command of commands) {
      if (command) {
        vitest.spyOn(command, "do").mockResolvedValue(undefined);
      }
    }

    await strategy.run();

    expect(commands[0]?.constructor).not.toStrictEqual(Commands.FileWriterCommand);
  });
});
