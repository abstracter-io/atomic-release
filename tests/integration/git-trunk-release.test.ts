import { vitest, describe, test, expect, beforeEach } from 'vitest'

import { SDK } from "../../src/index";
import { Stubs } from "../stubs";

const HEAD_HASH = "c658ea3e060490dced90dfb34c018d88b8e797f9";
const LOGGER = new Stubs.LoggerStub();

const commit = () => {
  return {
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
    hash: HEAD_HASH,
    committedTimestamp: 1633686020134,
  };
};

const releaseOptions = () => {
  return {
    logger: LOGGER,
    conventionalChangelogWriterContext: {
      owner: "t",
      repository: "t",
      host: "https://github.com",
      repoUrl: "https://github.com/t/t",
      date: "2021-10-08",
    },
  };
};

describe("git trunk release", () => {
  let release: SDK.Release;
  let gitClient: InstanceType<typeof Stubs.GitClientStub>;

  beforeEach(async () => {
    gitClient = new Stubs.GitClientStub();

    release = await SDK.gitTrunkRelease({
      gitClient,
      ...releaseOptions(),
    });

    gitClient.refHash.mockImplementation(async () => {
      return HEAD_HASH;
    });

    gitClient.commits.mockImplementation(async () => {
      return [commit()];
    });

    gitClient.refName.mockImplementation(async () => {
      return "main";
    });
  });

  test("changelog is null", async () => {
    const changelogCommitFilter = vitest.fn();
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),
      gitClient,
      changelogCommitFilter,
    });

    expect(await release.getChangelog()).toBeNull();
    expect(changelogCommitFilter).toBeCalledTimes(1);
  });

  test('list previous versions', async () => {});

  test("generating a changelog", async () => {
    const rawConventionalCommits = vitest.fn(async (range: string) => {
      const commits = await gitClient.commits(range);

      return commits.map((commit) => {
        const lines = [
          // subject
          `${commit.subject}`,

          // body
          `${commit.body}`,

          // extra fields
          "-hash-",
          `${commit.hash}`,

          "-gitTags-",
          `${commit.tags.join(",")}`,

          "-committerDate-",
          `${new Date(1633686020134)}`,
        ];

        return {
          hash: commit.hash,
          raw: lines.join("\n"),
        };
      });
    });
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),

      gitClient,

      rawConventionalCommits,
    });

    const changelog = await release.getChangelog();

    expect(changelog).toMatchSnapshot();

    expect(rawConventionalCommits).toBeCalledWith(`${HEAD_HASH.slice(0, 7)} -1`);
  });

  test("next version is 'HEAD' hash", async () => {
    const expectedHash = HEAD_HASH.slice(0, 7);

    expect(await release.getNextVersion()).toStrictEqual(expectedHash);
  });

  test("list issues mentioned in commits", async () => {
    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...commit(),
          subject: "feat!: ... closes #3, #46, #39",
        },
      ];
    });

    expect(await release.getMentionedIssues()).toStrictEqual(new Set(["3", "39", "46"]));
  });

  test("previous version changelog is null", async () => {
    const hash = "10f03409c73ffa37fbd2b890d99c74c63d0f9f03";
    const changelogCommitFilter = vitest.fn(() => {
      return false;
    });
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),

      gitClient,

      changelogCommitFilter,
    });

    gitClient.commits.mockImplementation(async () => {
      return [commit(), { ...commit(), hash }];
    });

    expect(await release.getChangelogByVersion(hash.slice(0, 7))).toBeNull();

    expect(changelogCommitFilter).toBeCalledTimes(1);
  });

  test("previous version changelog is generated", async () => {
    const hash = "10f03409c73ffa37fbd2b890d99c74c63d0f9f03";

    gitClient.commits.mockImplementation(async () => {
      return [commit(), { ...commit(), hash }];
    });

    const changelog = await release.getChangelogByVersion(hash.slice(0, 7));

    expect(changelog).not.toBeNull();
    expect(changelog).toMatchSnapshot();
  });

  test("previous version fallbacks to 'HEAD' hash", async () => {
    const hash = HEAD_HASH.slice(0, 7);

    expect(await release.getPreviousVersion()).toStrictEqual(hash);

    expect(LOGGER.info).toBeCalledWith(`Could not find a previous version. Will use HEAD hash ${hash} as initial version`);
  });

  test("previous version is the second commit hash", async () => {
    const expectedVersion = HEAD_HASH.slice(0, 7);

    gitClient.commits.mockImplementation(async () => {
      return [
        { ...commit(), hash: "1234" },

        { ...commit(), hash: HEAD_HASH },
      ];
    });

    expect(await release.getPreviousVersion()).toStrictEqual(expectedVersion);
  });

  test("generating changelog fails when writer context is missing", async () => {
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),
      gitClient,
      conventionalChangelogWriterContext: null as never,
    });
    const expectedError = new Error("conventional changelog writer context is missing");

    expect(await release.getChangelog().catch((e) => {
      return e;
    })).toStrictEqual(expectedError);
  });

  test("generating version changelog returns null when version does not exists", async () => {
    const rawConventionalCommits = vitest.fn(async () => []);
    const release = await SDK.gitTrunkRelease({
      ...releaseOptions(),

      gitClient,

      rawConventionalCommits,
    });

    expect(await release.getChangelogByVersion('xyz')).toStrictEqual(null);
  });
});
