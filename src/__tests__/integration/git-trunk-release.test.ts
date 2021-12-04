import { Release } from "../../ports/release";
import { GitExecaClient } from "../../adapters/git-execa-client";
import { gitTrunkRelease } from "../../adapters/git-trunk-release";

import { spiedLogger } from "../stubs/spied-logger";

const LOGGER = spiedLogger();
const HASH = "c658ea3e060490dced90dfb34c018d88b8e797f9";

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
    hash: HASH,
    committedTimestamp: 1633686020134,
  };
};

describe("git trunk release", () => {
  let release: Release;
  let gitClient: jest.Mocked<GitExecaClient>;

  beforeEach(async () => {
    gitClient = new GitClientStub() as unknown as jest.Mocked<GitExecaClient>;

    gitClient.refHash.mockImplementation(async () => {
      return HASH;
    });

    gitClient.commits.mockImplementation(async () => [commit()]);

    gitClient.refName.mockImplementation(async () => "main");

    release = await gitTrunkRelease({
      gitClient,
      ...releaseOptions(),
    });
  });

  test("changelog is null", async () => {
    const changelogCommitFilter = jest.fn();
    const release = await gitTrunkRelease({
      ...releaseOptions(),
      gitClient,
      changelogCommitFilter,
    });

    expect(await release.getChangelog()).toBeNull();
    expect(changelogCommitFilter).toBeCalledTimes(1);
  });

  test("changelog is generated", async () => {
    const release = await gitTrunkRelease({
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
      },
    });

    const changelog = await release.getChangelog();

    expect(changelog).toMatchSnapshot();
  });

  test("next version is 'HEAD' hash", async () => {
    const expectedHash = HASH.slice(0, 7);

    expect(await release.getNextVersion()).toStrictEqual(expectedHash);
  });

  test("list issues mentioned in commits", async () => {
    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...commit(),
          subject: "feat!: ... closes #3, #46, #39",
        },
        { ...commit(), subject: "Merge pull request #999 from repo/branch" },
      ];
    });

    expect(await release.getMentionedIssues()).toStrictEqual(new Set(["3", "39", "46", "999"]));
  });

  test("previous version changelog is null", async () => {
    const hash = "10f03409c73ffa37fbd2b890d99c74c63d0f9f03";
    const changelogCommitFilter = jest.fn(() => false);
    const release = await gitTrunkRelease({
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
    const hash = HASH.slice(0, 7);

    expect(await release.getPreviousVersion()).toStrictEqual(hash);

    expect(LOGGER.info).toBeCalledWith(`Could not find a previous version. Will use ${hash} as initial version`);
  });

  test("previous version is the second commit hash", async () => {
    const expectedVersion = HASH.slice(0, 7);

    gitClient.commits.mockImplementation(async () => {
      return [
        { ...commit(), hash: "1234" },

        { ...commit(), hash: HASH },
      ];
    });

    expect(await release.getPreviousVersion()).toStrictEqual(expectedVersion);
  });

  test("rawConventionalCommits is called with 'HEAD' ref", async () => {
    const rawConventionalCommits = jest.fn();
    const release = await gitTrunkRelease({
      ...releaseOptions(),

      gitClient,

      rawConventionalCommits,
    });

    rawConventionalCommits.mockImplementation(() => []);

    await release.getChangelog();

    expect(rawConventionalCommits).toBeCalledWith(`HEAD -1`);
  });

  test("generating changelog fails when writer context is missing", async () => {
    const release = await gitTrunkRelease({
      ...releaseOptions(),
      gitClient,
      conventionalChangelogWriterContext: null as never,
    });
    const expectedError = new Error(`conventional changelog writer context is missing`);

    expect(await release.getChangelog().catch((e) => e)).toStrictEqual(expectedError);
  });

  test("generating changelog by version fails when version does not exists", async () => {
    const version = "fffferrt";
    const expectedError = new Error(`Could not find commits for version '${version}'`);

    expect(await release.getChangelogByVersion(version).catch((e) => e)).toStrictEqual(expectedError);
  });
});
