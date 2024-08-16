import { vitest, describe, test, expect } from 'vitest';

import { Stubs } from '../stubs.js';
import { SDK, Commands } from '../../src/index.js';

const WORKING_DIRECTORY = '/this/is/sparta';

const releaseConfig = (): SDK.GitTagBasedReleaseConfig => {
  return {
    gitClient: new Stubs.GitClientStub(),
    logger: Stubs.NoopLogger.INSTANCE,
    preReleaseBranches: new Set([Stubs.GitClientStub.PRE_RELEASE_BRANCH_NAME]),
    conventionalChangelogWriterContext: {
      owner: 'owner',
      repository: 'repo_name',
      host: 'https://github.com',
      repoUrl: 'https://github.com/owner/repo_name',
    },
  };
};

const strategyConfig = (): SDK.GithubNpmPackageStrategyConfig => {
  return {
    gitClient: new Stubs.GitClientStub(),
    logger: Stubs.NoopLogger.INSTANCE,
    gitActor: 'Rick Sanchez <rick.sanchez@github.com>',
    gitRemote: 'origin-test',
    workingDirectory: WORKING_DIRECTORY,
    changelogFilePath: `${WORKING_DIRECTORY}/CHANGELOG.md`,
    releaseBranchNames: new Set([
      Stubs.GitClientStub.STABLE_BRANCH_NAME,
      Stubs.GitClientStub.PRE_RELEASE_BRANCH_NAME,
    ]),
    githubPersonalAccessToken: 'github-personal-access-token',
  };
};

describe('github npm package strategy', () => {
  test('commands state', async () => {
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseConfig(),
      gitClient,
    });
    const strategy = await SDK.githubNpmPackageStrategy({
      ...strategyConfig(),
      release,
      gitClient,
      releaseBranchNames: new Set(['test']),
    });

    gitClient.refName.mockImplementationOnce(async () => {
      return Stubs.GitClientStub.STABLE_BRANCH_NAME;
    });

    gitClient.listTags.mockImplementationOnce(async () => {
      return [{
        name: 'v0.0.0',
        hash: Stubs.GitClientStub.HASH,
      }];
    });

    gitClient.commits.mockImplementationOnce(async () => {
      return [{
        ...Stubs.conventionalCommit(),
        subject: 'feat!: ...',
      }];
    });

    await Stubs.fixedDate(new Date('2024-08-05'), async () => {
      // @ts-expect-error protected method
      await expect(strategy.getCommands()).resolves.toMatchSnapshot();
    });
  });

  test('command errored', async () => {
    const logger = new Stubs.LoggerStub();
    const release = await SDK.gitTagBasedRelease(releaseConfig());
    const strategy = await SDK.githubNpmPackageStrategy({
      ...strategyConfig(),
      logger,
      release,
    });
    const expectedError = new Error('Error');

    // @ts-expect-error protected method can be spied
    vitest.spyOn(strategy, 'getCommands').mockImplementationOnce(() => {
      return [
        {
          getName() {
            return 'Dummy Command';
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

    expect(logger.error).toBeCalledWith('Strategy execution failed');
  });

  test('does not run when version has not changed', async () => {
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseConfig(),
      gitClient,
    });
    const strategy = await SDK.githubNpmPackageStrategy({
      ...strategyConfig(),
      release,
      gitClient,
    });

    // @ts-expect-error protected method can be spied
    const shouldRunSpy = vitest.spyOn(strategy, 'shouldRun');

    gitClient.commits.mockImplementation(async () => {
      return [];
    });

    await strategy.run();

    expect(shouldRunSpy).lastReturnedWith(Promise.resolve(true));
  });

  test('does not run when branch is not a release branch', async () => {
    const logger = new Stubs.LoggerStub();
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease(releaseConfig());
    const strategy = await SDK.githubNpmPackageStrategy({
      ...strategyConfig(),
      release,
      logger,
      gitClient,
      releaseBranchNames: new Set(['test']),
    });

    // @ts-expect-error protected method can be spied
    const shouldRunSpy = vitest.spyOn(strategy, 'shouldRun');

    await strategy.run();

    expect(shouldRunSpy).lastReturnedWith(Promise.resolve(false));

    expect(logger.info).toBeCalledWith(`Branch '${Stubs.GitClientStub.PRE_RELEASE_BRANCH_NAME}' is not a release branch`);
  });

  test('does not run when remote/local branch hash differ', async () => {
    const logger = new Stubs.LoggerStub();
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease(releaseConfig());
    const strategy = await SDK.githubNpmPackageStrategy({
      ...strategyConfig(),
      release,
      logger,
      gitClient,
    });

    // @ts-expect-error protected method can be spied
    const getCommandsSpy = vitest.spyOn(strategy, 'getCommands');

    gitClient.remoteBranchHash.mockImplementation(async () => {
      return '1';
    });

    await strategy.run();

    expect(getCommandsSpy).not.toBeCalled();

    expect(logger.info).toBeCalledWith('Branch local hash is not the same as its remote counterpart');
  });

  test('changelog writer command is null when changelog is empty', async () => {
    const logger = new Stubs.LoggerStub();
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease(releaseConfig());
    const strategy = await SDK.githubNpmPackageStrategy({
      ...strategyConfig(),
      logger,
      release,
      syncRemote: true,
      releaseBranchNames: new Set(['test']),
      gitClient,
    });

    vitest.spyOn(release, 'getChangelog').mockImplementationOnce(async () => {
      return null;
    });

    vitest.spyOn(release, 'getChangelogByVersion').mockImplementationOnce(async () => {
      return null;
    });

    // @ts-expect-error protected method can be spied
    const commands = await strategy.getCommands();

    // @ts-expect-error protected method can be spied
    vitest.spyOn(strategy, 'getCommands').mockReturnValueOnce(commands);

    for (const command of commands) {
      vitest.spyOn(command, 'do').mockResolvedValue(undefined);
    }

    await strategy.run();

    expect(commands[0]?.constructor).not.toStrictEqual(Commands.FileWriterCommand);
  });
});
