import getStream from "get-stream";
import intoStream from "into-stream";
import { ConventionalChangelogPreset } from "conventional-changelog-preset-loader";
import conventionalChangelogPreset from "conventional-changelog-conventionalcommits";
import conventionalChangelogWriter, { ChangelogWriterContext } from "conventional-changelog-writer";
import { ConventionalCommit, sync as syncConventionalCommitParser } from "conventional-commits-parser";

import { Logger } from "../../ports/logger";
import { memoize } from "../../utils/memoize";
import { Release } from "../../ports/release";
import { GitExecaClient } from "../git-execa-client";
import { processStdoutLogger } from "../process-stdout-logger";

type GitTrunkReleaseOptions = {
  logger?: Logger;

  gitClient?: GitExecaClient;

  remote?: string;

  workingDirectory?: string;

  changelogCommitFilter?: (commit: ConventionalCommit) => boolean;

  rawConventionalCommits?: (range: string) => Promise<{ hash: string; raw: string }[]>;

  conventionalChangelogPreset?: ConventionalChangelogPreset;

  conventionalChangelogWriterContext: ChangelogWriterContext | null;
};

type Options = Required<GitTrunkReleaseOptions>;

const defaultOptions = async (options: GitTrunkReleaseOptions): Promise<Options> => {
  const workingDirectory = options.workingDirectory ?? process.cwd();
  const remote = options.remote ?? "origin";
  const gitClient = options.gitClient ?? new GitExecaClient({
    remote,
    workingDirectory,
  });
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

  const changelogCommitFilter = (_commit: ConventionalCommit): boolean => {
    return true;
  };

  return {
    remote,
    gitClient,
    workingDirectory,

    logger: options.logger ?? processStdoutLogger({ name: "GitTrunkRelease" }),
    changelogCommitFilter: options.changelogCommitFilter ?? changelogCommitFilter,
    rawConventionalCommits: options.rawConventionalCommits ?? rawConventionalCommits,
    conventionalChangelogPreset: options.conventionalChangelogPreset ?? (await conventionalChangelogPreset()),
    conventionalChangelogWriterContext: options.conventionalChangelogWriterContext ?? null,
  };
};

const gitTrunkRelease = async (options: GitTrunkReleaseOptions): Promise<Release> => {
  const memo = memoize();
  const { logger, ...opt } = await defaultOptions(options);
  const preset = opt.conventionalChangelogPreset;
  const gitClient = opt.gitClient;
  const headHash = await gitClient.refHash("HEAD");

  // Private methods
  // ================
  const parseCommit = (rawConventionalCommit: string): ConventionalCommit => {
    return syncConventionalCommitParser(rawConventionalCommit, preset.parserOpts);
  };

  const getChangelogWriterContext = (): ChangelogWriterContext => {
    if (opt.conventionalChangelogWriterContext) {
      return opt.conventionalChangelogWriterContext;
    }

    throw new Error("conventional changelog writer context is missing");
  };

  const getConventionalCommits = async (): Promise<ConventionalCommit[]> => {
    return memo("conventional_commits", async () => {
      const commits = await opt.rawConventionalCommits("-1");
      const parsedCommits = commits.map((commit) => {
        return parseCommit(commit.raw);
      });

      return parsedCommits.filter(opt.changelogCommitFilter);
    });
  };

  const getPreviousVersionsConventionalCommits = async (): Promise<{ [version: string]: ConventionalCommit[] }> => {
    return memo("previous_versions_conventional_commits", async () => {
      const commits = await gitClient.commits("HEAD");
      const versionsConventionalCommits = {};

      // remove the first ('HEAD') commit
      commits.shift();

      await Promise.all(commits.map(async (commit) => {
        const [rawConventionalCommit] = await opt.rawConventionalCommits(`${commit.hash} -1`);
        const commits = [parseCommit(rawConventionalCommit.raw)];

        versionsConventionalCommits[commit.hash.slice(0, 7)] = commits.filter(opt.changelogCommitFilter);
      }));

      return versionsConventionalCommits;
    });
  };

  // Public methods
  // ==============
  const getVersions = async (): Promise<string[]> => {
    return memo("versions", async () => {
      const commits = await gitClient.commits("HEAD");

      commits.shift();

      return commits.map((commit) => {
        return commit.hash.slice(0, 7);
      });
    });
  };

  const getChangelog = async (): Promise<string | null> => {
    return memo("changelog", async () => {
      const nextVersion = await getNextVersion();
      const commits = await getConventionalCommits();

      if (commits.length) {
        const writerOpts = preset.writerOpts;
        const writerContext = {
          ...getChangelogWriterContext(),
          version: nextVersion,
        };
        const stream = intoStream.object(commits).pipe(conventionalChangelogWriter(writerContext, writerOpts));

        return getStream(stream);
      }

      return null;
    });
  };

  const getNextVersion = async (): Promise<string> => {
    return memo("next_version", async () => {
      return headHash.slice(0, 7);
    });
  };

  const getPreviousVersion = async (): Promise<string> => {
    return memo("previous_version", async () => {
      const versions = await getVersions();

      if (!versions.length) {
        const hash = headHash.slice(0, 7);

        logger.info(`Could not find a previous version. Will use ${hash} as initial version`);

        return hash;
      }

      return versions[0];
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

  const getChangelogByVersion = async (version: string): Promise<string | null> => {
    return memo(`changelog_${version}`, async () => {
      const versionsConventionalCommits = await getPreviousVersionsConventionalCommits();
      const commits = versionsConventionalCommits[version];

      if (Array.isArray(commits)) {
        if (commits.length) {
          const writerOpts = preset.writerOpts;
          const writerContext = {
            ...getChangelogWriterContext(),
            version,
          };
          const stream = intoStream.object(commits).pipe(conventionalChangelogWriter(writerContext, writerOpts));

          return getStream(stream);
        }

        return null;
      }

      throw new Error(`Could not find commits for version '${version}'`);
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

export { gitTrunkRelease, GitTrunkReleaseOptions };
