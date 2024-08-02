// @ts-expect-error no types
import conventionalChangelogPreset from "conventional-changelog-conventionalcommits";
import { vitest, describe, test, expect, beforeEach } from 'vitest'

import { SDK } from "../../src/index";
import { Stubs } from "../stubs";

const HASH = "c658ea3e060490dced90dfb34c018d88b8e797f9";
const LOGGER = new Stubs.LoggerStub();
const STABLE_BRANCH_NAME = "main";
const PRE_RELEASE_BRANCH_NAME = "beta";

class GitClientStub extends SDK.GitExecClient {
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

const commit = () => {
  return {
    subject: "feat: ...",
    body: "test",
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

const releaseOptions = () => {
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
      date: "2021-10-08",
    },
  };
};

describe("git tag based release", () => {
  let release: SDK.Release;
  let gitClient: GitClientStub;

  beforeEach(async () => {
    gitClient = new GitClientStub();

    release = await SDK.gitTagBasedRelease({
      gitClient,
      ...releaseOptions(),
    });

    gitClient.refHash.mockImplementation(async () => {
      return HASH;
    });

    gitClient.commits.mockImplementation(async () => {
      return [commit()];
    });

    gitClient.refName.mockImplementation(async () => {
      return STABLE_BRANCH_NAME;
    });

    gitClient.cliVersion.mockImplementation(async () => {
      return "2.7.0";
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

  test("filter non release commits", async () => {
    const expectedCommit = commit();
    const isReleaseCommit = vitest.fn();
    const release = await SDK.gitTagBasedRelease({
      gitClient,
      isReleaseCommit,
      ...releaseOptions(),
    });

    isReleaseCommit.mockImplementation(() => {
      return false;
    });

    gitClient.commits.mockImplementation(async () => {
      return [expectedCommit];
    });

    await release.getNextVersion();

    expect(LOGGER.info).toBeCalledWith("Filtered 1 commit(s)");

    expect(isReleaseCommit).toBeCalledTimes(1);
  });

  test("next version patch is bumped", async () => {
    const version = "0.1.0";
    const previousTag = { name: `v${version}`, hash: HASH };

    gitClient.refName.mockImplementation(async () => {
      return STABLE_BRANCH_NAME;
    });

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...commit(),
          subject: "fix: ...",
        },
      ];
    });

    gitClient.mergedTags.mockImplementation(async () => {
      return [previousTag];
    });

    expect(await release.getNextVersion()).toStrictEqual("0.1.1");

    expect(LOGGER.info).toBeCalledWith("Found 1 new commits");
  });

  test("next version minor is bumped", async () => {
    const version = "0.1.0";
    const previousTag = { name: `v${version}`, hash: HASH };

    gitClient.refName.mockImplementation(async () => {
      return STABLE_BRANCH_NAME;
    });

    gitClient.commits.mockImplementation(async () => {
      return [commit()];
    });

    gitClient.mergedTags.mockImplementation(async () => {
      return [previousTag];
    });

    expect(await release.getNextVersion()).toStrictEqual("0.2.0");
  });

  test("next version major is bumped", async () => {
    const version = "0.1.0";
    const previousTag = { name: `v${version}`, hash: HASH };

    gitClient.refName.mockImplementation(async () => {
      return STABLE_BRANCH_NAME;
    });

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...commit(),
          subject: "feat!: ...",
        },
      ];
    });

    gitClient.mergedTags.mockImplementation(async () => {
      return [previousTag];
    });

    expect(await release.getNextVersion()).toStrictEqual("1.0.0");
  });

  test("lists tags as released versions", async () => {
    const version = "0.1.0";
    const tag = { name: `v${version}`, hash: HASH };

    gitClient.mergedTags.mockImplementation(async () => {
      return [tag];
    });

    expect(await release.listVersions()).toStrictEqual([version]);

    expect(gitClient.mergedTags).toBeCalledWith("HEAD");
  });

  test("release change log is generated", async () => {
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

  test("list issues mentioned in commits", async () => {
    const version = "0.1.0";
    const previousTag = { name: `v${version}`, hash: HASH };

    gitClient.refName.mockImplementation(async () => {
      return STABLE_BRANCH_NAME;
    });

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...commit(),
          subject: "feat!: ... closes #3, #46, #39",
        },
        { ...commit(), subject: "Merge pull request #999 from repo/branch" },
      ];
    });

    gitClient.mergedTags.mockImplementation(async () => {
      return [previousTag];
    });

    expect(await release.getMentionedIssues()).toStrictEqual(new Set(["3", "39", "46", "999"]));
  });

  test("previous version is latest stable", async () => {
    const expectedVersion = "2.0.0";

    gitClient.refName.mockImplementation(async () => {
      return PRE_RELEASE_BRANCH_NAME;
    });

    gitClient.mergedTags.mockImplementation(async () => {
      return [{ name: `v${expectedVersion}`, hash: HASH }];
    });

    expect(await release.getPreviousVersion()).toStrictEqual(expectedVersion);
  });

  test("non semantic tag names are filtered", async () => {
    const tag = { name: "v2.0", hash: HASH };

    gitClient.mergedTags.mockImplementation(async () => {
      return [tag];
    });

    expect(await release.listVersions()).toHaveLength(0);
    expect(LOGGER.debug).toBeCalledWith(`Filtered tag '${tag.name}'. Tag name is not a valid semantic version`);
  });

  test("next version bump uses pre release id", async () => {
    const version = "0.1.0-beta.0";
    const previousTag = { name: `v${version}`, hash: HASH };

    gitClient.refName.mockImplementation(async () => {
      return PRE_RELEASE_BRANCH_NAME;
    });

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...commit(),
          subject: "feat!: ...",
        },
      ];
    });

    gitClient.mergedTags.mockImplementation(async () => {
      return [previousTag];
    });

    expect(await release.getNextVersion()).toStrictEqual("0.1.0-beta.1");
  });

  test("previous release change log is generated", async () => {
    const versions = await release.listVersions();

    for (const version of versions) {
      const changelog = await release.getChangelogByVersion(version);

      expect(changelog).toMatchSnapshot();
    }
  });

  test("previous version fallback to initial version", async () => {
    const initialVersion = "1.1.1";

    release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
      initialVersion,
    });

    gitClient.refName.mockImplementation(async () => {
      return STABLE_BRANCH_NAME;
    });

    gitClient.mergedTags.mockImplementation(async () => {
      return [];
    });

    expect(await release.getPreviousVersion()).toStrictEqual(initialVersion);

    expect(LOGGER.info).toBeCalledWith(
      `Could not find a previous version. Will use ${initialVersion} as initial version`,
    );
  });

  test("previous version is the highest released version", async () => {
    const tags = [
      { name: "v0.1.0", hash: HASH },
      { name: "v0.2.0", hash: HASH },
      { name: "v0.3.0", hash: HASH },
    ];

    gitClient.refName.mockImplementation(async () => {
      return STABLE_BRANCH_NAME;
    });

    gitClient.mergedTags.mockImplementation(async () => {
      return tags;
    });

    expect(await release.getPreviousVersion()).toStrictEqual("0.3.0");
  });

  test("rawConventionalCommits is called with 'since' range", async () => {
    const rawConventionalCommits = vitest.fn();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),

      gitClient,

      rawConventionalCommits,
    });

    rawConventionalCommits.mockImplementation(() => {
      return [];
    });

    await release.getNextVersion();

    expect(rawConventionalCommits).toBeCalledWith(`${HASH}..`);
  });

  test("rawConventionalCommits is called with 'until' range", async () => {
    const rawConventionalCommits = vitest.fn();
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),

      gitClient,

      rawConventionalCommits,
    });

    rawConventionalCommits.mockImplementation(() => {
      return [];
    });

    gitClient.mergedTags.mockImplementation(async () => {
      return [];
    });

    await release.getNextVersion();

    expect(rawConventionalCommits).toBeCalledWith(HASH);
  });

  test("versions are derived from pre release and stable tags", async () => {
    const stableTag = { name: "v0.1.0", hash: HASH };
    const preReleaseTag = { name: `v0.1.1-${PRE_RELEASE_BRANCH_NAME}.0`, hash: HASH };

    gitClient.refName.mockImplementation(async () => {
      return PRE_RELEASE_BRANCH_NAME;
    });

    gitClient.mergedTags.mockImplementation(async () => {
      return [
        preReleaseTag,
        stableTag,

        // This is a tag of another branch, it should not be included
        { name: "v0.1.1-next.0", hash: HASH },
      ];
    });

    expect(await release.listVersions(2)).toStrictEqual([
      preReleaseTag.name.slice(1),
      stableTag.name.slice(1),
    ]);
  });

  test("previous version fails when initial version is invalid", async () => {
    const initialVersion = "v2.0";
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
      initialVersion,
    });
    const expectedError = new Error(`${initialVersion} is not a semantic version`);
    gitClient.refName.mockImplementation(async () => {
      return STABLE_BRANCH_NAME;
    });

    gitClient.mergedTags.mockImplementation(async () => {
      return [];
    });

    expect(await release.getPreviousVersion().catch((e) => {
      return e;
    })).toStrictEqual(expectedError);
  });

  test("generating changelog fails when writer context is missing", async () => {
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
      conventionalChangelogWriterContext: null as never,
    });
    const expectedError = new Error("conventional changelog writer context is missing");

    expect(await release.getChangelog().catch((e) => {
      return e;
    })).toStrictEqual(expectedError);
  });

  test("next version fails when a tag with the same version exists", async () => {
    const nextVersion = "1.1.0";
    const tag = { name: "v1.0.0", hash: HASH };
    const release = await SDK.gitTagBasedRelease({
      ...releaseOptions(),
      gitClient,
    });
    const expectedError = new Error('Tag already exists in remote.');

    gitClient.mergedTags.mockImplementation(async () => {
      return [tag];
    });
    gitClient.remoteTagHash.mockImplementation(async () => {
      return tag.hash;
    });

    await expect(release.getNextVersion()).rejects.toStrictEqual(expectedError);

    expect(LOGGER.warn).toBeCalledWith(`A tag named 'v${nextVersion}' already exists.`);

    expect(LOGGER.warn).toBeCalledWith(`You can fix this by branching from ${tag.hash}`);
  });

  test("default release commits are 'perf', 'fix' or 'feat' / 'feature'", async () => {
    const version = "1.0.0";
    const commits = [
      { ...commit(), subject: "perf: ..." },
      { ...commit(), subject: "fix: ..." },
      { ...commit(), subject: "feat: ..." },
      { ...commit(), subject: "feature: ..." },
      { ...commit(), subject: "docs: ..." },
    ];
    const expectedVersions = ["1.0.1", "1.0.1", "1.1.0", "1.1.0", "1.0.0"];

    gitClient.mergedTags.mockImplementation(async () => {
      return [{ name: `v${version}`, hash: HASH }];
    });

    for (const commit of commits) {
      const release = await SDK.gitTagBasedRelease({
        gitClient,
        ...releaseOptions(),
      });

      gitClient.commits.mockImplementation(async () => {
        return [commit];
      });

      expect(await release.getNextVersion()).toStrictEqual(expectedVersions.shift());
    }
  });

  test("generating version changelog fails when version does not exists", async () => {
    const version = "1.1.1";
    const expectedError = new Error(`Could not find version ${version} conventional commits`);

    expect(await release.getChangelogByVersion(version).catch((e) => {
      return e;
    })).toStrictEqual(expectedError);
  });

  test("default commits filter throws when commit does not have 'type' property", async () => {
    const preset = await conventionalChangelogPreset();
    const expectedError = new Error("Non supported conventional commit. Provide a custom filter.");

    preset.parser.headerCorrespondence = ["b", "c", "d"];

    const release = await SDK.gitTagBasedRelease({
      gitClient,
      conventionalChangelogPreset: preset,
      ...releaseOptions(),
    });

    expect(await release.getNextVersion().catch((e) => {
      return e;
    })).toStrictEqual(expectedError);
  });
});
