import conventionalCommitsParser from "conventional-commits-parser";
import conventionalChangelogPreset from "conventional-changelog-conventionalcommits";

import { Release } from "../../ports/release";
import { GitExecaClient } from "../../adapters/git-execa-client";
import { gitSemanticRelease } from "../../adapters/git-semantic-release";

import { spiedLogger } from "../stubs/spied-logger";

const LOGGER = spiedLogger();
const HASH = "c658ea3e060490dced90dfb34c018d88b8e797f9";
const STABLE_BRANCH_NAME = "main";
const PRE_RELEASE_BRANCH_NAME = "beta";

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

describe("git semantic release", () => {
  let release: Release;
  let gitClient: jest.Mocked<GitExecaClient>;

  beforeEach(async () => {
    gitClient = new GitClientStub() as unknown as jest.Mocked<GitExecaClient>;

    release = await gitSemanticRelease({
      gitClient,
      ...releaseOptions(),
    });

    gitClient.cliVersion.mockImplementation(async () => "2.7.0");

    gitClient.refHash.mockImplementation(async () => HASH);

    gitClient.commits.mockImplementation(async () => [commit()]);

    gitClient.refName.mockImplementation(async () => STABLE_BRANCH_NAME);

    gitClient.mergedTags.mockImplementation(async () => {
      const name = "v0.1.0";
      const hash = HASH;

      return [{ name, hash }];
    });

    gitClient.remoteTagHash.mockImplementation(async () => null);

    gitClient.remoteBranchHash.mockImplementation(async () => HASH);
  });

  test("filter non release commits", async () => {
    const expectedCommit = commit();
    const isReleaseCommit = jest.fn();
    const release = await gitSemanticRelease({
      gitClient,
      isReleaseCommit,
      ...releaseOptions(),
    });

    isReleaseCommit.mockImplementation(() => {
      return false;
    });

    gitClient.commits.mockImplementation(async () => [expectedCommit]);

    await release.getNextVersion();

    expect(LOGGER.info).toBeCalledWith(`Filtered 1 commit`);
    expect(isReleaseCommit).toBeCalledTimes(1);
  });

  test("next version patch is bumped", async () => {
    const version = "0.1.0";
    const previousTag = { name: `v${version}`, hash: HASH };

    gitClient.refName.mockImplementation(async () => STABLE_BRANCH_NAME);

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...commit(),
          subject: "fix: ...",
        },
      ];
    });

    gitClient.mergedTags.mockImplementation(async () => [previousTag]);

    expect(await release.getNextVersion()).toStrictEqual("0.1.1");

    expect(LOGGER.info).toBeCalledWith(`Found 1 new commits`);
  });

  test("next version minor is bumped", async () => {
    const version = "0.1.0";
    const previousTag = { name: `v${version}`, hash: HASH };

    gitClient.refName.mockImplementation(async () => STABLE_BRANCH_NAME);

    gitClient.commits.mockImplementation(async () => [commit()]);

    gitClient.mergedTags.mockImplementation(async () => [previousTag]);

    expect(await release.getNextVersion()).toStrictEqual("0.2.0");
  });

  test("next version major is bumped", async () => {
    const version = "0.1.0";
    const previousTag = { name: `v${version}`, hash: HASH };

    gitClient.refName.mockImplementation(async () => STABLE_BRANCH_NAME);

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...commit(),
          subject: "feat!: ...",
        },
      ];
    });

    gitClient.mergedTags.mockImplementation(async () => [previousTag]);

    expect(await release.getNextVersion()).toStrictEqual("1.0.0");
  });

  test("lists tags as released versions", async () => {
    const version = "0.1.0";
    const tag = { name: `v${version}`, hash: HASH };

    gitClient.mergedTags.mockImplementation(async () => [tag]);

    expect(await release.getVersions()).toStrictEqual([version]);
    expect(gitClient.mergedTags).toBeCalledWith("HEAD");
  });

  test("release change log is generated", async () => {
    const release = await gitSemanticRelease({
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

    gitClient.refName.mockImplementation(async () => STABLE_BRANCH_NAME);

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...commit(),
          subject: "feat!: ... closes #3, #46, #39",
        },
        { ...commit(), subject: "Merge pull request #999 from repo/branch" },
      ];
    });

    gitClient.mergedTags.mockImplementation(async () => [previousTag]);

    expect(await release.getMentionedIssues()).toStrictEqual(new Set(["3", "39", "46", "999"]));
  });

  test("previous version is latest stable", async () => {
    const expectedVersion = "2.0.0";

    gitClient.refName.mockImplementation(async () => PRE_RELEASE_BRANCH_NAME);

    gitClient.mergedTags.mockImplementation(async () => {
      return [{ name: `v${expectedVersion}`, hash: HASH }];
    });

    expect(await release.getPreviousVersion()).toStrictEqual(expectedVersion);
  });

  test("next version bump using pre release", async () => {
    const version = "0.1.0-beta.0";
    const previousTag = { name: `v${version}`, hash: HASH };

    gitClient.refName.mockImplementation(async () => PRE_RELEASE_BRANCH_NAME);

    gitClient.commits.mockImplementation(async () => {
      return [
        {
          ...commit(),
          subject: "feat!: ...",
        },
      ];
    });

    gitClient.mergedTags.mockImplementation(async () => [previousTag]);

    expect(await release.getNextVersion()).toStrictEqual("0.1.0-beta.1");
  });

  test("non semantic tag names are filtered", async () => {
    const tag = { name: `v2.0`, hash: HASH };

    gitClient.mergedTags.mockImplementation(async () => [tag]);

    expect(await release.getVersions()).toHaveLength(0);
    expect(LOGGER.debug).toBeCalledWith(`Filtered tag '${tag.name}'. Tag name is not a valid semantic version`);
  });

  test("previous release change log is generated", async () => {
    const versions = await release.getVersions();

    for (const version of versions) {
      const changelog = await release.getChangelogByVersion(version);

      expect(changelog).toMatchSnapshot();
    }
  });

  test("previous version fallback to initial version", async () => {
    const initialVersion = "1.1.1";

    release = await gitSemanticRelease({
      ...releaseOptions(),
      gitClient,
      initialVersion,
    });

    gitClient.refName.mockImplementation(async () => STABLE_BRANCH_NAME);

    gitClient.mergedTags.mockImplementation(async () => []);

    expect(await release.getPreviousVersion()).toStrictEqual(initialVersion);

    expect(LOGGER.info).toBeCalledWith(
      `Could not find a previous version. Will use ${initialVersion} as initial version`
    );
  });

  test("previous version is the highest released version", async () => {
    const tags = [
      { name: `v0.1.0`, hash: HASH },
      { name: `v0.2.0`, hash: HASH },
      { name: `v0.3.0`, hash: HASH },
    ];

    gitClient.refName.mockImplementation(async () => STABLE_BRANCH_NAME);

    gitClient.mergedTags.mockImplementation(async () => tags);

    expect(await release.getPreviousVersion()).toStrictEqual("0.3.0");
  });

  test("rawConventionalCommits is called with 'since' range", async () => {
    const rawConventionalCommits = jest.fn();
    const release = await gitSemanticRelease({
      ...releaseOptions(),

      gitClient,

      rawConventionalCommits,
    });

    rawConventionalCommits.mockImplementation(() => []);

    await release.getNextVersion();

    expect(rawConventionalCommits).toBeCalledWith(`${HASH}..`);
  });

  test("rawConventionalCommits is called with 'until' range", async () => {
    const rawConventionalCommits = jest.fn();
    const release = await gitSemanticRelease({
      ...releaseOptions(),

      gitClient,

      rawConventionalCommits,
    });

    rawConventionalCommits.mockImplementation(() => []);

    gitClient.mergedTags.mockImplementation(async () => []);

    await release.getNextVersion();

    expect(rawConventionalCommits).toBeCalledWith(HASH);
  });

  test("versions are derived from pre release and stable tags", async () => {
    const stableTag = { name: "v0.1.0", hash: HASH };
    const preReleaseTag = { name: `v0.1.1-${PRE_RELEASE_BRANCH_NAME}.0`, hash: HASH };

    gitClient.refName.mockImplementation(async () => PRE_RELEASE_BRANCH_NAME);

    gitClient.mergedTags.mockImplementation(async () => [
      preReleaseTag,
      stableTag,

      // This is a tag of another branch, it should not be included
      { name: `v0.1.1-next.0`, hash: HASH },
    ]);

    expect(await release.getVersions()).toStrictEqual([
      // fp
      preReleaseTag.name.slice(1),
      stableTag.name.slice(1),
    ]);
  });

  test("next version fails when stable branch name is missing", async () => {
    const release = await gitSemanticRelease({
      ...releaseOptions(),
      gitClient,
      stableBranchName: undefined as never,
    });
    const expectedError = new Error(`Stable branch name is missing`);

    expect(await release.getNextVersion().catch((e) => e)).toStrictEqual(expectedError);
  });

  test("previous version fails when initial version is invalid", async () => {
    const initialVersion = "v2.0";
    const release = await gitSemanticRelease({
      ...releaseOptions(),
      gitClient,
      initialVersion,
    });
    const expectedError = new Error(`${initialVersion} is not a semantic version`);
    gitClient.refName.mockImplementation(async () => STABLE_BRANCH_NAME);

    gitClient.mergedTags.mockImplementation(async () => []);

    expect(await release.getPreviousVersion().catch((e) => e)).toStrictEqual(expectedError);
  });

  test("generating changelog fails when writer context is missing", async () => {
    const release = await gitSemanticRelease({
      ...releaseOptions(),
      gitClient,
      conventionalChangelogWriterContext: null as never,
    });
    const expectedError = new Error(`conventional changelog writer context is missing`);

    expect(await release.getChangelog().catch((e) => e)).toStrictEqual(expectedError);
  });

  test("next version fails when a tag with the same version exists", async () => {
    const nextVersion = "1.1.0";
    const tag = { name: `v1.0.0`, hash: HASH };
    const release = await gitSemanticRelease({
      ...releaseOptions(),
      gitClient,
    });
    const expectedError = new Error(`A tag for version '${nextVersion}' already exists (tag hash: ${tag.hash})`);

    gitClient.mergedTags.mockImplementation(async () => [tag]);
    gitClient.remoteTagHash.mockImplementation(async () => tag.hash);

    expect(await release.getNextVersion().catch((e) => e)).toStrictEqual(expectedError);

    expect(LOGGER.warn).toBeCalledWith(`Version ${nextVersion} was already released. (tag: v${nextVersion})`);

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

    gitClient.mergedTags.mockImplementation(async () => [{ name: `v${version}`, hash: HASH }]);

    for (const commit of commits) {
      const release = await gitSemanticRelease({
        gitClient,
        ...releaseOptions(),
      });

      gitClient.commits.mockImplementation(async () => [commit]);

      expect(await release.getNextVersion()).toStrictEqual(expectedVersions.shift());
    }
  });

  test("generating version changelog fails when version does not exists", async () => {
    const version = "1.1.1";
    const expectedError = new Error(`Could not find version ${version} conventional commits`);

    expect(await release.getChangelogByVersion(version).catch((e) => e)).toStrictEqual(expectedError);
  });

  test("default release commits filter throws when commit is missing type", async () => {
    const parser = jest.spyOn(conventionalCommitsParser, "sync");
    const expectedError = new Error("Non supported conventional commit. Provide a custom filter.");

    parser.mockImplementationOnce((rawCommit) => {
      const conventionalCommit = conventionalCommitsParser.sync(rawCommit);

      delete conventionalCommit.type;

      return conventionalCommit;
    });

    expect(await release.getNextVersion().catch((e) => e)).toStrictEqual(expectedError);
  });

  test("next version fails when pre release branch is missing pre release id", async () => {
    const release = await gitSemanticRelease({
      ...releaseOptions(),
      gitClient,
      preReleaseBranches: {},
    });
    const branchName = PRE_RELEASE_BRANCH_NAME;
    const expectedError = new Error(`Could not find pre release id for branch '${branchName}'`);

    gitClient.refName.mockImplementation(async () => branchName);

    expect(await release.getNextVersion().catch((e) => e)).toStrictEqual(expectedError);
  });

  test("default 'isReleaseCommit' throws when commit does not have 'type' property", async () => {
    const preset = await conventionalChangelogPreset();
    const expectedError = new Error(`Non supported conventional commit. Provide a custom filter.`);

    preset.parserOpts.headerCorrespondence = ["b", "c", "d"];

    const release = await gitSemanticRelease({
      gitClient,
      conventionalChangelogPreset: preset,
      ...releaseOptions(),
    });

    expect(await release.getNextVersion().catch((e) => e)).toStrictEqual(expectedError);
  });
});
