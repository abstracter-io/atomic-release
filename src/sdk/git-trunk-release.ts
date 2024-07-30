import { memo } from "radash";
import { loadPreset } from "conventional-changelog-preset-loader";
import { Commit as ConventionalCommit, CommitParser, ParserOptions } from "conventional-commits-parser";
import { writeChangelogString, Options as WriterOptions, Context as WriterContext } from "conventional-changelog-writer";

import { Logger } from "./logger";
import { Release } from "./release";
import { GitExecaClient } from "./git-execa-client";
import { processStdoutLogger } from "./process-stdout-logger";

type ConventionalPreset = {
  parser: ParserOptions;
  writer: WriterOptions;
  whatBump: (commits: ConventionalCommit[]) => { level: number, reason: string };
};

type GitTrunkReleaseConfig = {
  logger?: Logger;

  gitClient?: GitExecaClient;

  remote?: string;

  workingDirectory?: string;

  changelogCommitFilter?: (commit: ConventionalCommit) => boolean;

  rawConventionalCommits?: (range: string) => Promise<{ hash: string; raw: string }[]>;

  conventionalChangelogPreset?: ConventionalPreset;

  conventionalChangelogWriterContext: WriterContext | null;
};

type Options = Required<GitTrunkReleaseConfig>;

const defaultConfig = async (config: GitTrunkReleaseConfig): Promise<Options> => {
  const workingDirectory = config.workingDirectory ?? process.cwd();
  const remote = config.remote ?? "origin";
  const gitClient = config.gitClient ?? new GitExecaClient({
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

    logger: config.logger ?? processStdoutLogger({ name: "GitTrunkRelease" }),
    changelogCommitFilter: config.changelogCommitFilter ?? changelogCommitFilter,
    rawConventionalCommits: config.rawConventionalCommits ?? rawConventionalCommits,
    conventionalChangelogPreset: config.conventionalChangelogPreset ?? (await loadPreset("conventionalcommits")),
    conventionalChangelogWriterContext: config.conventionalChangelogWriterContext ?? null,
  };
};

const trimHash = (hash: string) => hash.slice(0, 7);

const gitTrunkRelease = async (config: GitTrunkReleaseConfig): Promise<Release> => {
  const { logger, ...opt } = await defaultConfig(config);
  const preset = opt.conventionalChangelogPreset;
  const gitClient = opt.gitClient;
  const commitParser = new CommitParser(preset.parser);

  // Private methods
  // ================
  const getHeadHash = memo(async () => {
    const hash = await gitClient.refHash("HEAD");

    return hash.slice(0, 7);
  });

  const parseCommit = (rawConventionalCommit: string): ConventionalCommit => {
    return commitParser.parse(rawConventionalCommit);
  };

  const generateChangelog = async (version: string, commits: ConventionalCommit[]): Promise<string | null> => {
    if (commits.length) {
      if (opt.conventionalChangelogWriterContext) {
        const context = {
          ...opt.conventionalChangelogWriterContext as WriterContext<any>,
          version,
        };

        return writeChangelogString(commits, context, preset.writer).then(c => {
          return c;
        });
      }

      throw new Error("conventional changelog writer context is missing");
    }

    return null;
  };

  const getConventionalCommitByCommitHash = memo(async (version: string): Promise<ConventionalCommit | null> => {
    const rawConventionalCommits = await opt.rawConventionalCommits(`${version} -1`);

    if (rawConventionalCommits.length) {
      const conventionalCommit = parseCommit(rawConventionalCommits[0].raw);

      if (opt.changelogCommitFilter(conventionalCommit)) {
        return conventionalCommit;
      }
    }

    return null;
  });

  // Public methods
  // ==============
  const listVersions = memo(async (max: number = 1): Promise<string[]> => {
    const commits = await gitClient.commits(`-n ${max + 1}`);

    // this shift removes the HEAD commit.
    commits.shift();

    return commits.map((commit) => {
      return trimHash(commit.hash);
    });
  });

  const getChangelog = memo(async (): Promise<string | null> => {
    const commitHash = await getNextVersion();

    return getChangelogByVersion(commitHash);
  });

  const getNextVersion = getHeadHash;

  const getPreviousVersion = memo(async (): Promise<string> => {
    const versions = await listVersions(1);

    if (!versions.length) {
      const hash = await getHeadHash();

      logger.info(`Could not find a previous version. Will use HEAD hash ${hash} as initial version`);

      return hash;
    }

    return versions[0];
  });

  const getMentionedIssues = memo(async (): Promise<Set<string>> => {
    const issues = new Set<string>();
    const commitHash = await getNextVersion();
    const conventionalCommit = await getConventionalCommitByCommitHash(commitHash);

    if (conventionalCommit) {
      for (const reference of conventionalCommit.references) {
        const issue = reference.issue;

        if (issue) {
          issues.add(issue);
        }
      }
    }

    return issues;
  });

  const getChangelogByVersion = memo(async (version: string): Promise<string | null> => {
    const conventionalCommit = await getConventionalCommitByCommitHash(version);

    if (conventionalCommit) {
      return generateChangelog(version, [conventionalCommit])
    }

    return null;
  });

  return {
    listVersions,
    getChangelog,
    getNextVersion,
    getMentionedIssues,
    getPreviousVersion,
    getChangelogByVersion,
  };
};

export { gitTrunkRelease, GitTrunkReleaseConfig };
