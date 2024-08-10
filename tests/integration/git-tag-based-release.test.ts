import { vitest, describe, test, expect } from 'vitest';
import conventionalChangelogPreset from 'conventional-changelog-conventionalcommits';

import { Stubs } from '../stubs.js';
import { SDK } from '../../src/index.js';

const releaseOptions = () => {
  return {
    logger: Stubs.NoopLogger.INSTANCE,
    stableBranchName: Stubs.GitClientStub.STABLE_BRANCH_NAME,
    preReleaseBranches: new Set([Stubs.GitClientStub.PRE_RELEASE_BRANCH_NAME]),
    conventionalChangelogWriterContext: {
      owner: 't',
      repository: 't',
      host: 'https://github.com',
      repoUrl: 'https://github.com/t/t',
      date: '2021-10-08',
    },
  };
};

describe('git tag based release', () => {
  test('default release commits', async () => {
    const cases = [
      { version: '1.0.1', commit: { ...Stubs.conventionalCommit(), subject: 'perf: ...' } },
      { version: '1.0.1', commit: { ...Stubs.conventionalCommit(), subject: 'fix: ...' } },
      { version: '1.1.0', commit: { ...Stubs.conventionalCommit(), subject: 'feat: ...' } },
      { version: '1.1.0', commit: { ...Stubs.conventionalCommit(), subject: 'feature: ...' } },
      { version: '1.0.0', commit: { ...Stubs.conventionalCommit(), subject: 'docs: ...' } },
    ];

    await Promise.all(cases.map(async ({ version, commit }) => {
      const gitClient = new Stubs.GitClientStub();
      const release = await SDK.gitTagBasedRelease({
        gitClient,
        ...releaseOptions(),
      });

      gitClient.refName.mockImplementation(async () => {
        return Stubs.GitClientStub.STABLE_BRANCH_NAME;
      });

      gitClient.listTags.mockImplementation(async () => {
        return [{ name: `v1.0.0`, hash: Stubs.GitClientStub.HASH }];
      });

      gitClient.commits.mockImplementationOnce(async () => {
        return [commit];
      });

      await expect(release.getNextVersion(), commit.subject).resolves.toStrictEqual(version);
    }));
  });

  test('filter non release commits', async () => {
    const expectedCommit = Stubs.conventionalCommit();
    const isReleaseCommit = vitest.fn();
    const logger = new Stubs.LoggerStub();
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      logger,
      gitClient,
      isReleaseCommit,
    });

    isReleaseCommit.mockImplementation(() => {
      return false;
    });

    gitClient.commits.mockImplementation(async () => {
      return [expectedCommit];
    });

    await release.getNextVersion();

    expect(logger.info).toBeCalledWith('Filtered 1 commit(s)');

    expect(isReleaseCommit).toBeCalledTimes(1);
  });

  test('next version patch is bumped', async () => {
    const version = '0.1.0';
    const previousTag = { name: `v${version}`, hash: Stubs.GitClientStub.HASH };
    const logger = new Stubs.LoggerStub();
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      logger,
      gitClient,
    });

    gitClient.refName.mockImplementation(async () => {
      return Stubs.GitClientStub.STABLE_BRANCH_NAME;
    });

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...Stubs.conventionalCommit(),
          subject: 'fix: ...',
        },
      ];
    });

    gitClient.listTags.mockImplementation(async () => {
      return [previousTag];
    });

    expect(await release.getNextVersion()).toStrictEqual('0.1.1');

    expect(logger.info).toBeCalledWith('Found 1 new commit(s)');
  });

  test('next version minor is bumped', async () => {
    const version = '0.1.0';
    const previousTag = { name: `v${version}`, hash: Stubs.GitClientStub.HASH };
    const logger = new Stubs.LoggerStub();
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      logger,
      gitClient,
    });

    gitClient.refName.mockImplementation(async () => {
      return Stubs.GitClientStub.STABLE_BRANCH_NAME;
    });

    gitClient.commits.mockImplementation(async () => {
      return [Stubs.conventionalCommit()];
    });

    gitClient.listTags.mockImplementation(async () => {
      return [previousTag];
    });

    expect(await release.getNextVersion()).toStrictEqual('0.2.0');
  });

  test('next version major is bumped', async () => {
    const version = '0.1.0';
    const previousTag = { name: `v${version}`, hash: Stubs.GitClientStub.HASH };
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
    });

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...Stubs.conventionalCommit(),
          subject: 'feat!: ...',
        },
      ];
    });

    gitClient.refName.mockImplementation(async () => {
      return Stubs.GitClientStub.STABLE_BRANCH_NAME;
    });

    gitClient.listTags.mockImplementation(async () => {
      return [previousTag];
    });

    expect(await release.getNextVersion()).toStrictEqual('1.0.0');
  });

  test('lists tags as released versions', async () => {
    const version = '0.1.0';
    const tag = { name: `v${version}`, hash: Stubs.GitClientStub.HASH };
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
    });

    gitClient.listTags.mockImplementation(async () => {
      return [tag];
    });

    expect(await release.listVersions(1)).toStrictEqual([version]);

    expect(gitClient.listTags).toBeCalledWith();
  });

  test('release change log is generated', async () => {
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),

      gitClient,

      rawConventionalCommits: async (range: string) => {
        const commits = await gitClient.commits(range);

        return commits.map((commit) => {
          const lines = [
            // subject
            `${commit.subject}`,

            // body
            `${commit.body}`,

            // extra fields
            '-hash-',
            `${commit.hash}`,

            '-gitTags-',
            `${commit.tags.join(',')}`,

            '-committerDate-',
            `${new Date(1633686020134)}`,
          ];

          return {
            hash: commit.hash,
            raw: lines.join('\n'),
          };
        });
      },
    });

    const changelog = await release.getChangelog();

    expect(changelog).toMatchSnapshot();
  });

  test('list issues mentioned in commits', async () => {
    const version = '0.1.0';
    const previousTag = { name: `v${version}`, hash: Stubs.GitClientStub.HASH };
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
    });

    gitClient.refName.mockImplementation(async () => {
      return Stubs.GitClientStub.STABLE_BRANCH_NAME;
    });

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...Stubs.conventionalCommit(),
          subject: 'feat!: ... closes #3, #46, #39',
        },
        { ...Stubs.conventionalCommit(), subject: 'Merge pull request #999 from repo/branch' },
      ];
    });

    gitClient.listTags.mockImplementation(async () => {
      return [previousTag];
    });

    expect(await release.getMentionedIssues()).toStrictEqual(new Set(['3', '39', '46', '999']));
  });

  test('non semantic tag names are filtered', async () => {
    const tag = { name: 'v2.0', hash: Stubs.GitClientStub.HASH };
    const logger = new Stubs.LoggerStub();
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      logger,
      gitClient,
    });

    gitClient.listTags.mockImplementation(async () => {
      return [tag];
    });

    expect(await release.listVersions(1)).toHaveLength(0);

    expect(logger.debug).toBeCalledWith(`Filtered tag '${tag.name}'. Tag name is not a valid semantic version`);
  });

  test('next version bump uses pre release id', async () => {
    const version = '0.1.0-beta.0';
    const previousTag = { name: `v${version}`, hash: Stubs.GitClientStub.HASH };
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
    });

    gitClient.refName.mockImplementation(async () => {
      return Stubs.GitClientStub.PRE_RELEASE_BRANCH_NAME;
    });

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...Stubs.conventionalCommit(),
          subject: 'feat!: ...',
        },
      ];
    });

    gitClient.listTags.mockImplementation(async () => {
      return [previousTag];
    });

    expect(await release.getNextVersion()).toStrictEqual('0.1.0-beta.1');
  });

  test('previous release change log is generated', async () => {
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
    });
    const versions = await release.listVersions(1);

    for (const version of versions) {
      const changelog = await release.getChangelogByVersion(version);

      expect(changelog).toMatchSnapshot();
    }
  });

  test('previous version fallback to initial version', async () => {
    const initialVersion = '1.1.1';
    const logger = new Stubs.LoggerStub();
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      logger,
      gitClient,
      initialVersion,
    });

    gitClient.refName.mockImplementation(async () => {
      return Stubs.GitClientStub.STABLE_BRANCH_NAME;
    });

    gitClient.listTags.mockImplementation(async () => {
      return [];
    });

    expect(await release.getPreviousVersion()).toStrictEqual(initialVersion);

    expect(logger.info).toBeCalledWith(`Could not find a previous version. Will use ${initialVersion} as initial version`);
  });

  test('previous version is the most recent stable version', async () => {
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
    });

    gitClient.refName.mockImplementation(async () => {
      return Stubs.GitClientStub.PRE_RELEASE_BRANCH_NAME;
    });

    gitClient.listTags.mockImplementation(async () => {
      // 1.0.1 is more recent (thus previous) than versions with prerelease components
      return [
        { name: 'v1.0.0-beta.0', hash: Stubs.GitClientStub.HASH },
        { name: `v1.0.1`, hash: Stubs.GitClientStub.HASH },
      ];
    });

    await expect(release.getPreviousVersion()).resolves.toStrictEqual('1.0.1');
  });

  test('previous version is most recent prerelease version', async () => {
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
    });

    gitClient.refName.mockImplementation(async () => {
      return Stubs.GitClientStub.PRE_RELEASE_BRANCH_NAME;
    });

    gitClient.listTags.mockImplementation(async () => {
      return [
        { name: `v1.0.0`, hash: Stubs.GitClientStub.HASH },
        { name: `v1.0.1-beta.0`, hash: Stubs.GitClientStub.HASH },
      ];
    });

    await expect(release.getPreviousVersion()).resolves.toStrictEqual('1.0.1-beta.0');
  });

  test('rawConventionalCommits is called with "since" range', async () => {
    const rawConventionalCommits = vitest.fn();
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
      rawConventionalCommits,
    });

    rawConventionalCommits.mockImplementation(() => {
      return [];
    });

    await release.getNextVersion();

    expect(rawConventionalCommits).toBeCalledWith(`${Stubs.GitClientStub.HASH}..`);
  });

  test('rawConventionalCommits is called with "until" range', async () => {
    const rawConventionalCommits = vitest.fn();
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
      rawConventionalCommits,
    });

    rawConventionalCommits.mockImplementation(() => {
      return [];
    });

    gitClient.listTags.mockImplementation(async () => {
      return [];
    });

    await release.getNextVersion();

    expect(rawConventionalCommits).toBeCalledWith(Stubs.GitClientStub.HASH);
  });

  test('versions are derived from pre release and stable tags', async () => {
    const stableTag = { name: 'v0.1.0', hash: Stubs.GitClientStub.HASH };
    const preReleaseTag = { name: `v0.1.1-${Stubs.GitClientStub.PRE_RELEASE_BRANCH_NAME}.0`, hash: Stubs.GitClientStub.HASH };
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
    });

    gitClient.refName.mockImplementation(async () => {
      return Stubs.GitClientStub.PRE_RELEASE_BRANCH_NAME;
    });

    gitClient.listTags.mockImplementation(async () => {
      return [
        preReleaseTag,
        stableTag,

        // This is a tag of another branch, it should not be included
        { name: 'v0.1.1-next.0', hash: Stubs.GitClientStub.HASH },
      ];
    });

    expect(await release.listVersions(2)).toStrictEqual([
      preReleaseTag.name.slice(1),
      stableTag.name.slice(1),
    ]);
  });

  test('previous version fails when initial version is invalid', async () => {
    const initialVersion = 'v2.0';
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      initialVersion,
      gitClient,
    });
    const expectedError = new Error(`initial version '${initialVersion}' is not a semantic version`);

    gitClient.refName.mockImplementation(async () => {
      return Stubs.GitClientStub.STABLE_BRANCH_NAME;
    });

    gitClient.listTags.mockImplementation(async () => {
      return [];
    });

    await expect(release.getPreviousVersion()).rejects.toStrictEqual(expectedError);
  });

  test('generating changelog fails when writer context is missing', async () => {
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
      conventionalChangelogWriterContext: null,
    });
    const expectedError = new Error('conventional changelog writer context is missing');

    await expect(release.getChangelog()).rejects.toStrictEqual(expectedError);
  });

  test('next version fails when a tag with the same version exists', async () => {
    const nextVersion = '1.1.0';
    const tag = { name: 'v1.0.0', hash: Stubs.GitClientStub.HASH };
    const logger = new Stubs.LoggerStub();
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      logger,
      gitClient,
    });
    const expectedError = new Error('Tag already exists in remote.');

    gitClient.refName.mockImplementationOnce(async () => {
      return Stubs.GitClientStub.STABLE_BRANCH_NAME;
    });

    gitClient.listTags.mockImplementation(async () => {
      return [tag];
    });

    gitClient.remoteTagHash.mockImplementation(async (): Promise<any> => {
      return tag.hash;
    });

    await expect(release.getNextVersion()).rejects.toStrictEqual(expectedError);

    expect(logger.warn).toBeCalledWith(`A tag named 'v${nextVersion}' already exists.`);

    expect(logger.warn).toBeCalledWith(`You can fix this by branching from ${tag.hash}`);
  });

  test('generating version changelog fails when version does not exists', async () => {
    const version = '1.1.1';
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
    });
    const expectedError = new Error(`Could not find tag for version ${version}`);

    await expect(release.getChangelogByVersion(version)).rejects.toStrictEqual(expectedError);
  });

  test('default commits filter throws when commit does not have "type" property', async () => {
    const gitClient = new Stubs.GitClientStub();
    const preset = await conventionalChangelogPreset();
    const expectedError = new Error('Non supported conventional commit. Provide a custom filter.');

    preset.parser.headerCorrespondence = ['b', 'c', 'd'];

    const release = await SDK.gitTagBasedRelease({
      gitClient,
      conventionalChangelogPreset: preset,
      ...releaseOptions(),
    });

    await expect(release.getNextVersion()).rejects.toStrictEqual(expectedError);
  });
});
