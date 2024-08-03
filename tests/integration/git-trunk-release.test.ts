import { vitest, describe, test, expect } from 'vitest';

import { SDK } from '../../src/index.js';
import { Stubs } from '../stubs.js';

const releaseOptions = () => {
  return {
    logger: Stubs.NoopLogger.INSTANCE,
    gitClient: new Stubs.GitClientStub(),
    conventionalChangelogWriterContext: {
      owner: 't',
      repository: 't',
      host: 'https://github.com',
      repoUrl: 'https://github.com/t/t',
      date: '2021-10-08',
    },
  };
};

describe('git trunk release', () => {
  test('changelog is null', async () => {
    const changelogCommitFilter = vitest.fn();
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),
      gitClient,
      changelogCommitFilter,
    });

    await expect(release.getChangelog()).resolves.toBeNull();

    expect(changelogCommitFilter).toBeCalledTimes(1);
  });

  test.todo('list previous versions');

  test('generating a changelog', async () => {
    const rawConventionalCommits = vitest.fn(async (range: string) => {
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
    });
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),

      gitClient,

      rawConventionalCommits,
    });
    const changelog = await release.getChangelog();

    expect(changelog).toMatchSnapshot();

    expect(rawConventionalCommits).toBeCalledWith(`${Stubs.GitClientStub.HASH.slice(0, 7)} -1`);
  });

  test('next version is \'HEAD\' hash', async () => {
    const release = await SDK.gitTrunkRelease(releaseOptions());
    const expectedHash = Stubs.GitClientStub.HASH.slice(0, 7);

    await expect(release.getNextVersion()).resolves.toStrictEqual(expectedHash);
  });

  test('list issues mentioned in commits', async () => {
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),
      gitClient,
    });

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...Stubs.conventionalCommit(),
          subject: 'feat!: ... closes #3, #46, #39',
        },
      ];
    });

    await expect(release.getMentionedIssues()).resolves.toStrictEqual(new Set(['3', '39', '46']));
  });

  test('previous version changelog is null', async () => {
    const hash = '10f03409c73ffa37fbd2b890d99c74c63d0f9f03';
    const changelogCommitFilter = vitest.fn(() => {
      return false;
    });
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),

      gitClient,

      changelogCommitFilter,
    });

    gitClient.commits.mockImplementation(async () => {
      return [
        Stubs.conventionalCommit(),
        { ...Stubs.conventionalCommit(), hash },
      ];
    });

    expect(await release.getChangelogByVersion(hash.slice(0, 7))).toBeNull();

    expect(changelogCommitFilter).toBeCalledTimes(1);
  });

  test('previous version changelog is generated', async () => {
    const hash = '10f03409c73ffa37fbd2b890d99c74c63d0f9f03';
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),
      gitClient,
    });

    gitClient.commits.mockImplementation(async () => {
      return [
        Stubs.conventionalCommit(),
        { ...Stubs.conventionalCommit(), hash },
      ];
    });

    return release.getChangelogByVersion(hash.slice(0, 7)).then((changelog) => {
      expect(changelog).not.toBeNull();

      expect(changelog).toMatchSnapshot();

      return;
    });
  });

  test('previous version fallbacks to \'HEAD\' hash', async () => {
    const hash = Stubs.GitClientStub.HASH.slice(0, 7);
    const logger = new Stubs.LoggerStub();
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),
      logger,
    });

    await expect(release.getPreviousVersion()).resolves.toStrictEqual(hash);

    expect(logger.info).toBeCalledWith(`Could not find a previous version. Will use HEAD hash ${hash} as initial version`);
  });

  test('previous version is the second commit hash', async () => {
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),
      gitClient,
    });
    const expectedVersion = Stubs.GitClientStub.HASH.slice(0, 7);

    gitClient.commits.mockImplementation(async () => {
      return [
        { ...Stubs.conventionalCommit(), hash: '1234' },

        { ...Stubs.conventionalCommit(), hash: Stubs.GitClientStub.HASH },
      ];
    });

    expect(await release.getPreviousVersion()).toStrictEqual(expectedVersion);
  });

  test('generating changelog fails when writer context is missing', async () => {
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),
      conventionalChangelogWriterContext: null as never,
    });
    const expectedError = new Error('conventional changelog writer context is missing');

    await expect(release.getChangelog()).rejects.toStrictEqual(expectedError);
  });

  test('generating version changelog returns null when version does not exists', async () => {
    const rawConventionalCommits = vitest.fn(async () => []);
    const gitClient = new Stubs.GitClientStub();
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),

      gitClient,

      rawConventionalCommits,
    });

    await expect(release.getChangelogByVersion('xyz')).resolves.toStrictEqual(null);
  });
});
