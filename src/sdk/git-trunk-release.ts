import { loadPreset } from "conventional-changelog-preset-loader";
import { Commit as ConventionalCommit, CommitParser, ParserOptions } from "conventional-commits-parser";
import { writeChangelogString, Options as WriterOptions, Context as WriterContext } from "conventional-changelog-writer";

import { Logger } from "./logger";
import { Release } from "./release";
import { GitExecaClient } from "./git-execa-client";
import { processStdoutLogger } from "./process-stdout-logger";

import { memoize } from "../utils/memoize";

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

const gitTrunkRelease = async (config: GitTrunkReleaseConfig): Promise<Release> => {
  const memo = memoize();
  const { logger, ...opt } = await defaultConfig(config);
  const preset = opt.conventionalChangelogPreset;
  const gitClient = opt.gitClient;
  const headHash = await gitClient.refHash("HEAD");
  const commitParser = new CommitParser(preset.parser);

  // Private methods
  // ================
  const parseCommit = (rawConventionalCommit: string): ConventionalCommit => {
    return commitParser.parse(rawConventionalCommit);
  };

  const getChangelogWriterContext = (): WriterContext<any> => {
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

      // FIXME: Perhaps its best to return the last two commits here

      commits.shift();

      return commits.map((commit) => {
        return commit.hash.slice(0, 7);
      });
    });
  };

  const getChangelog = async (): Promise<string | null> => {
    return memo("changelog", async () => {
      const [nextVersion, commits] = await Promise.all([
        getNextVersion(),
        getConventionalCommits()
      ]);

      if (commits.length) {
        const context = {
          ...getChangelogWriterContext(),
          version: nextVersion,
        };

        return writeChangelogString(commits, context, preset.writer).then(c => {
          return c;
        });
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
          const context = {
            ...getChangelogWriterContext(),
            version,
          };

          return writeChangelogString(commits, context, preset.writer).then(c => {
            return c;
          });
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

export { gitTrunkRelease, GitTrunkReleaseConfig };
