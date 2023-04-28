import semver from "semver";
import getStream from "get-stream";
import intoStream from "into-stream";
import { ConventionalChangelogPreset } from "conventional-changelog-preset-loader";
import conventionalChangelogPreset from "conventional-changelog-conventionalcommits";
import conventionalChangelogWriter, { ChangelogWriterContext } from "conventional-changelog-writer";
import { ConventionalCommit, sync as syncConventionalCommitParser } from "conventional-commits-parser";

import { Logger } from "../../ports/logger";
import { memoize } from "../../utils/memoize";
import { Release } from "../../ports/release";
import { processStdoutLogger } from "../process-stdout-logger";
import { GitExecaClient, MergedTag } from "../git-execa-client";

type GitSemanticReleaseOptions = {
  logger?: Logger;

  gitClient?: GitExecaClient;

  remote?: string;

  initialVersion?: string;

  stableBranchName: string;

  workingDirectory?: string;

  preReleaseBranches?: {
    [branchName: string]: string;
  };

  rawConventionalCommits?: (range: string) => Promise<{ hash: string; raw: string }[]>;

  isReleaseCommit?: (commit: ConventionalCommit) => boolean;

  conventionalChangelogPreset?: ConventionalChangelogPreset;

  conventionalChangelogWriterContext: ChangelogWriterContext | null;
};

type Options = Required<GitSemanticReleaseOptions>;

const sortTags = (tags: MergedTag[]): MergedTag[] => {
  return tags.sort((a, b) => {
    return semver.rcompare(a.name, b.name);
  });
};

const inc = (version: string, type: string, preReleaseId?: string) => {
  let v: string | null;

  if (preReleaseId) {
    v = semver.inc(version, "prerelease", preReleaseId);
  }
  else {
    v = semver.inc(version, type as semver.ReleaseType);
  }

  if (v === null) {
    throw new Error(`semantic version is '${version}' is not valid`);
  }

  return v;
};

const clean = (version: string) => {
  const v = semver.clean(version);

  if (v === null) {
    throw new Error(`semantic version is '${version}' is not valid`);
  }

  return v;
}

const defaultOptions = async (options: GitSemanticReleaseOptions): Promise<Options> => {
  const stableBranchName = options.stableBranchName;
  const workingDirectory = options.workingDirectory ?? process.cwd();
  const remote = options.remote ?? "origin";
  const gitClient = options.gitClient ?? new GitExecaClient({
    remote,
    workingDirectory,
  });
  const isReleaseCommit = (commit: ConventionalCommit): boolean => {
    const type = commit.type;

    if (!Object.prototype.hasOwnProperty.call(commit, "type")) {
      throw new Error("Non supported conventional commit. Provide a custom filter.");
    }

    if (typeof type === "string") {
      return /feat|fix|perf/.test(type);
    }

    return false;
  };

  const rawConventionalCommits = async (range: string) => {
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
        `${new Date(commit.committedTimestamp)}`,
      ];

      return {
        hash: commit.hash,
        raw: lines.join("\n"),
      };
    });
  };

  return {
    remote,
    gitClient,
    workingDirectory,
    stableBranchName,

    logger: options.logger ?? processStdoutLogger({ name: "GitSemanticRelease" }),
    initialVersion: options.initialVersion ?? "0.0.0",
    preReleaseBranches: options.preReleaseBranches ?? {},
    isReleaseCommit: options.isReleaseCommit ?? isReleaseCommit,
    rawConventionalCommits: options.rawConventionalCommits ?? rawConventionalCommits,
    conventionalChangelogPreset: options.conventionalChangelogPreset ?? (await conventionalChangelogPreset()),
    conventionalChangelogWriterContext: options.conventionalChangelogWriterContext ?? null,
  };
};

const gitSemanticRelease = async (options: GitSemanticReleaseOptions): Promise<Release> => {
  const memo = memoize();
  const { logger, ...opt } = await defaultOptions(options);
  const preset = opt.conventionalChangelogPreset;
  const gitClient = opt.gitClient;

  // Private methods
  // ================
  const getBranchName = () => {
    return memo("branch_name", async () => {
      return gitClient.refName("HEAD");
    });
  };

  const getMergedTags = async (): Promise<MergedTag[]> => {
    return memo("tags", async () => {
      const mergedHeadTags = await gitClient.mergedTags("HEAD");
      const preReleaseId = await getPreReleaseId();
      const stableTags: MergedTag[] = [];
      const branchTags: MergedTag[] = [];
      const filteredTags: MergedTag[] = [];

      for (const tag of mergedHeadTags) {
        const preReleaseComponents = semver.prerelease(tag.name) as string[] | null;
        const tagPreReleaseId = preReleaseComponents?.[0] ?? undefined;

        if (!semver.valid(tag.name)) {
          logger.debug(`Filtered tag '${tag.name}'. Tag name is not a valid semantic version`);

          filteredTags.push(tag);
        }
        //
        else if (tagPreReleaseId === undefined) {
          stableTags.push(tag);
        }
        //
        else if (preReleaseId && tagPreReleaseId === preReleaseId) {
          branchTags.push(tag);
        }
      }

      filteredTags.length && logger.info(`Filtered ${filteredTags.length} tags`);

      return [...sortTags(branchTags), ...sortTags(stableTags)];
    });
  };

  const getPreReleaseId = async (): Promise<string | undefined> => {
    return memo("pre_release_id", async () => {
      if (opt.stableBranchName) {
        const branchName = await getBranchName();
        const preReleaseId = opt.preReleaseBranches[branchName];

        if (branchName === opt.stableBranchName) {
          return undefined;
        }

        if (preReleaseId) {
          return preReleaseId;
        }
        //

        throw new Error(`Could not find pre release id for branch '${branchName}'`);
      }

      throw new Error("Stable branch name is missing");
    });
  };

  const parseCommit = async (rawConventionalCommit: string): Promise<ConventionalCommit> => {
    return syncConventionalCommitParser(rawConventionalCommit, preset.parserOpts);
  };

  const getConventionalCommits = async (): Promise<ConventionalCommit[]> => {
    return memo("conventional_commits", async () => {
      const tags = await getMergedTags();
      const until = await gitClient.refHash("HEAD");

      const since = tags[0]?.hash;
      const range = since ? `${since}..` : until;
      const commits = await opt.rawConventionalCommits(range);
      const parsedCommits = commits.map((commit) => {
        return parseCommit(commit.raw);
      });

      logger.info(`Retrieving commits ${since ? `since ${since}` : `until ${until}`}`);

      return Promise.all(parsedCommits);
    });
  };

  const getAllVersionsConventionalCommits = async (): Promise<{ [version: string]: ConventionalCommit[] }> => {
    return memo("versions_conventional_commits", async () => {
      const tags = await getMergedTags();
      const versionsConventionalCommits = {};

      if (tags.length) {
        const taken = new Set();
        const untilHash = tags[0].hash;
        const rawConventionalCommits = await opt.rawConventionalCommits(untilHash);
        const hashIndices = new Map<string, number>();

        for (let i = 0; i < rawConventionalCommits.length; i++) {
          hashIndices.set(rawConventionalCommits[i].hash, i);
        }

        for (let i = tags.length - 1; i > -1; i -= 1) {
          const tag = tags[i];
          const conventionalCommits: ConventionalCommit[] = [];

          let j = hashIndices.get(tag.hash);

          /* istanbul ignore if */
          if (j === undefined) {
            throw new Error("Can this happen??");
          }

          for (let l = rawConventionalCommits.length; j < l; j += 1) {
            const commit = rawConventionalCommits[j];

            if (!taken.has(commit.hash)) {
              // eslint-disable-next-line no-await-in-loop
              conventionalCommits.push(await parseCommit(commit.raw));

              taken.add(commit.hash);
            }
          }

          versionsConventionalCommits[clean(tag.name)] = conventionalCommits;
        }
      }

      return versionsConventionalCommits;
    });
  };

  const getChangelogWriterContext = (): ChangelogWriterContext => {
    if (opt.conventionalChangelogWriterContext) {
      return opt.conventionalChangelogWriterContext;
    }

    throw new Error("conventional changelog writer context is missing");
  };

  // Public methods
  // ==============
  const getVersions = async (): Promise<string[]> => {
    return memo("versions", async () => {
      const tags = await getMergedTags();

      return tags.map((tags) => {
        return clean(tags.name);
      });
    });
  };

  const getChangelog = async (): Promise<string> => {
    return memo("changelog", async () => {
      const nextVersion = await getNextVersion();
      const commits = await getConventionalCommits();
      const writerOpts = preset.writerOpts;
      const writerContext = {
        ...getChangelogWriterContext(),
        version: nextVersion,
      };
      const stream = intoStream.object(commits).pipe(conventionalChangelogWriter(writerContext, writerOpts));

      return getStream(stream);
    });
  };

  const getNextVersion = async (): Promise<string> => {
    return memo<Promise<string>>("next_version", async () => {
      const previousVersion = await getPreviousVersion();
      const conventionalCommits = await getConventionalCommits();
      const releaseCommits = conventionalCommits.filter(opt.isReleaseCommit);
      const totalFiltered = conventionalCommits.length - releaseCommits.length;

      logger.info(`Found ${conventionalCommits.length} new commits`);

      totalFiltered && logger.info(`Filtered ${totalFiltered} commit${totalFiltered > 1 ? "s" : ""}`);

      if (releaseCommits.length) {
        const preReleaseId = await getPreReleaseId();
        const bump = preset.recommendedBumpOpts.whatBump(releaseCommits);
        const type = { 0: "major", 1: "minor", 2: "patch" }[bump.level];
        const next = inc(previousVersion, type, preReleaseId);
        const name = `v${next}`;
        const hash = await gitClient.remoteTagHash(name);

        logger.info(bump.reason);

        if (hash) {
          logger.warn(`Version ${next} was already released. (tag: ${name})`);
          logger.warn(`You can fix this by branching from ${hash}`);

          throw new Error(`A tag for version '${next}' already exists (tag hash: ${hash})`);
        }

        return next;
      }

      return previousVersion;
    });
  };

  const getMentionedIssues = async (): Promise<Set<string>> => {
    return memo("mentioned_issues", async () => {
      const issues = new Set<string>();
      const commits = await getConventionalCommits();

      for (const commit of commits) {
        for (const reference of commit.references) {
          const issue = reference.issue;

          if (issue) {
            issues.add(issue);
          }
        }
      }

      return issues;
    });
  };

  const getPreviousVersion = async (): Promise<string> => {
    return memo("previous_version", async () => {
      const versions = await getVersions();

      if (versions.length) {
        return versions[0];
      }

      logger.info(`Could not find a previous version. Will use ${opt.initialVersion} as initial version`);

      if (!semver.valid(opt.initialVersion)) {
        throw new Error(`${opt.initialVersion} is not a semantic version`);
      }

      return opt.initialVersion;
    });
  };

  const getChangelogByVersion = async (version: string): Promise<string> => {
    return memo(`changelog_${version}`, async () => {
      const versionsConventionalCommits = await getAllVersionsConventionalCommits();
      const commits = versionsConventionalCommits[version];

      if (commits) {
        const writerOpts = preset.writerOpts;
        const writerContext = {
          ...getChangelogWriterContext(),
          version,
        };
        const stream = intoStream.object(commits).pipe(conventionalChangelogWriter(writerContext, writerOpts));

        return getStream(stream);
      }

      throw new Error(`Could not find version ${version} conventional commits`);
    });
  };

  return {
    getVersions,
    getChangelog,
    getNextVersion,
    getMentionedIssues,
    getPreviousVersion,
    getChangelogByVersion,
  };
};

export { gitSemanticRelease, GitSemanticReleaseOptions };
