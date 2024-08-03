import semver from 'semver';
import { memo } from 'radash';
import { loadPreset } from 'conventional-changelog-preset-loader';
import { Commit as ConventionalCommit, CommitParser, ParserOptions } from 'conventional-commits-parser';
import { writeChangelogString, Options as WriterOptions, Context as WriterContext } from 'conventional-changelog-writer';

import { Logger } from './logger.js';
import { Release } from './release.js';
import { processStdoutLogger } from './process-stdout-logger.js';
import { GitExecClient, MergedTag } from './git-exec-client.js';

type ConventionalPreset = {
  parser: ParserOptions;
  writer: WriterOptions;
  whatBump: (commits: ConventionalCommit[]) => { level: number; reason: string };
};

type GitTagBasedReleaseConfig = {
  logger?: Logger;

  remote?: string;

  gitClient?: GitExecClient;

  initialVersion?: string;

  workingDirectory?: string;

  preReleaseBranches?: Set<string>;

  rawConventionalCommits?: (range: string) => Promise<{ hash: string; raw: string }[]>;

  isReleaseCommit?: (commit: ConventionalCommit) => boolean;

  conventionalChangelogPreset?: ConventionalPreset;

  conventionalChangelogWriterContext: WriterContext | null;
};

type Options = Required<GitTagBasedReleaseConfig>;

const sortTags = (tags: MergedTag[]): MergedTag[] => {
  return tags.sort((a, b) => {
    return semver.rcompare(a.name, b.name);
  });
};

const inc = (version: string, type: string, preReleaseId?: string) => {
  let v: string | null;

  if (preReleaseId) {
    v = semver.inc(version, 'prerelease', preReleaseId);
  }
  else {
    v = semver.inc(version, type as semver.ReleaseType);
  }

  if (v === null) {
    throw new Error(`semantic version is '${version}' is not valid`);
  }

  return v;
};

const clean = (tagName: string) => {
  const version = semver.clean(tagName);

  if (version === null) {
    throw new Error(`semantic version is '${version}' is not valid`);
  }

  return version;
};

const defaultConfig = async (config: GitTagBasedReleaseConfig): Promise<Options> => {
  const remote = config.remote ?? 'origin';
  const workingDirectory = config.workingDirectory ?? process.cwd();
  const gitClient = config.gitClient ?? new GitExecClient({
    remote,
    workingDirectory,
  });
  const isReleaseCommit = (commit: ConventionalCommit): boolean => {
    const type = commit.type;

    if (!Object.prototype.hasOwnProperty.call(commit, 'type')) {
      throw new Error('Non supported conventional commit. Provide a custom filter.');
    }

    if (typeof type === 'string') {
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
        '-hash-',
        `${commit.hash}`,

        '-gitTags-',
        `${commit.tags.join(',')}`,

        '-committerDate-',
        `${new Date(commit.committedTimestamp)}`,
      ];

      return {
        hash: commit.hash,
        raw: lines.join('\n'),
      };
    });
  };

  return {
    remote,
    gitClient,
    workingDirectory,
    logger: config.logger ?? processStdoutLogger({ name: 'gitTagBasedRelease' }),
    initialVersion: config.initialVersion ?? '0.0.0',
    preReleaseBranches: config.preReleaseBranches ?? new Set(),
    isReleaseCommit: config.isReleaseCommit ?? isReleaseCommit,
    rawConventionalCommits: config.rawConventionalCommits ?? rawConventionalCommits,
    conventionalChangelogPreset: config.conventionalChangelogPreset ?? (await loadPreset('conventionalcommits')),
    conventionalChangelogWriterContext: config.conventionalChangelogWriterContext ?? null,
  };
};

const presetBumpLevelToSemanticComponent = (level: number): string => {
  if (level === 0) {
    return 'major';
  }

  if (level === 1) {
    return 'minor';
  }

  if (level === 2) {
    return 'patch';
  }

  throw new Error(`unexpected level: ${level}`);
};

const gitTagBasedRelease = async (config: GitTagBasedReleaseConfig): Promise<Release> => {
  const { logger, ...opt } = await defaultConfig(config);
  const preset = opt.conventionalChangelogPreset;
  const gitClient = opt.gitClient;
  const commitParser = new CommitParser(preset.parser);

  // Private methods
  // ================
  const getPreReleaseId = memo(async () => {
    const branchName = await gitClient.refName('HEAD');

    return opt.preReleaseBranches.has(branchName) ? branchName : undefined;
  });

  const parseCommit = (rawConventionalCommit: string): ConventionalCommit => {
    return commitParser.parse(rawConventionalCommit);
  };

  const getMergedTags = memo(async (): Promise<MergedTag[]> => {
    const [preReleaseId, mergedHeadTags] = await Promise.all([
      getPreReleaseId(),
      gitClient.mergedTags('HEAD'),
    ]);
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
      else if (tagPreReleaseId === undefined) {
        stableTags.push(tag);
      }
      else if (preReleaseId && tagPreReleaseId === preReleaseId) {
        branchTags.push(tag);
      }
    }

    if (filteredTags.length) {
      logger.info(`Filtered ${filteredTags.length} tag(s)`);
    }

    return [...sortTags(branchTags), ...sortTags(stableTags)];
  });

  const getConventionalCommits = memo(async (): Promise<ConventionalCommit[]> => {
    const tags = await getMergedTags();
    const until = await gitClient.refHash('HEAD');
    const since = tags[0]?.hash;
    const range = since ? `${since}..` : until;
    const commits = await opt.rawConventionalCommits(range);
    const parsedCommits = commits.map((commit) => {
      return parseCommit(commit.raw);
    });

    logger.info(`Retrieving commits ${since ? `since tag ${tags[0].name} (ref: ${since})` : `until ${until}`}`);

    return Promise.all(parsedCommits).then((c) => {
      return c;
    });
  });

  const getVersionConventionalCommits = memo(async (version: string): Promise<ConventionalCommit[]> => {
    const mergedTags = await getMergedTags();
    const versionIndex = mergedTags.findIndex(tag => clean(tag.name) === version);

    // ['1.3.0', '1.2.0', '1.1.0']
    //    ^ ------ ^ ------- ^
    if (versionIndex !== -1) {
      const versionTag = mergedTags[versionIndex];
      const previousTag = mergedTags[versionIndex + 1];
      const range = previousTag ? `${previousTag.hash}..${versionTag.hash}` : versionTag.hash;
      const rawConventionalCommits = await opt.rawConventionalCommits(range);
      const conventionalCommits: ConventionalCommit[] = [];

      await Promise.all(rawConventionalCommits.map(async (commit) => {
        const conventionalCommit = parseCommit(commit.raw);

        if (opt.isReleaseCommit(conventionalCommit)) {
          conventionalCommits.push(conventionalCommit);
        }
      }));

      return conventionalCommits;
    }

    throw new Error(`Could not find tag for version ${version}`);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getChangelogWriterContext = (): WriterContext<any> => {
    if (opt.conventionalChangelogWriterContext) {
      return opt.conventionalChangelogWriterContext;
    }

    throw new Error('conventional changelog writer context is missing');
  };

  // Public methods
  // ==============
  const listVersions = memo(async (max = 1): Promise<string[]> => {
    const tags = await getMergedTags();

    tags.length = Math.min(tags.length, max);

    return tags.map((tags) => {
      return clean(tags.name);
    });
  });

  const getChangelog = memo(async (): Promise<string> => {
    const nextVersion = await getNextVersion();
    const commits = await getConventionalCommits();
    const context = {
      ...getChangelogWriterContext(),
      version: nextVersion,
    };

    return writeChangelogString(commits, context, preset.writer).then((c) => {
      return c;
    });
  });

  const getNextVersion = memo(async (): Promise<string> => {
    const [previousVersion, conventionalCommits] = await Promise.all([
      getPreviousVersion(),
      getConventionalCommits(),
    ]);
    const releaseCommits = conventionalCommits.filter(opt.isReleaseCommit);
    const totalFiltered = conventionalCommits.length - releaseCommits.length;

    logger.info(`Found ${conventionalCommits.length} new commit(s)`);

    logger.info(`Filtered ${totalFiltered} commit(s)`);

    if (releaseCommits.length) {
      const preReleaseId = await getPreReleaseId();
      const bump = preset.whatBump(releaseCommits);
      const type = presetBumpLevelToSemanticComponent(bump.level);
      const next = inc(previousVersion, type, preReleaseId);
      const name = `v${next}`;
      const hash = await gitClient.remoteTagHash(name);

      if (hash) {
        logger.warn(`A tag named '${name}' already exists.`);

        logger.warn(`You can fix this by branching from ${hash}`);

        throw new Error('Tag already exists in remote.');
      }

      logger.info(bump.reason);

      return next;
    }

    return previousVersion;
  });

  const getPreviousVersion = memo(async (): Promise<string> => {
    const versions = await listVersions();

    if (versions.length) {
      return versions[0];
    }

    logger.info(`Could not find a previous version. Will use ${opt.initialVersion} as initial version`);

    if (!semver.valid(opt.initialVersion)) {
      throw new Error(`initial version '${opt.initialVersion}' is not a semantic version`);
    }

    return opt.initialVersion;
  });

  const getMentionedIssues = memo(async (): Promise<Set<string>> => {
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

  const getChangelogByVersion = memo(async (version: string): Promise<string> => {
    const conventionalCommits = await getVersionConventionalCommits(version);

    if (conventionalCommits.length) {
      const context = {
        ...getChangelogWriterContext(),
        version,
      };

      return writeChangelogString(conventionalCommits, context, preset.writer).then((c) => {
        return c;
      });
    }

    // This should not happen, as the version input is expected
    // to derive from a call to listVersions()
    throw new Error(`There are no conventional commits for version ${version}`);
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

export { gitTagBasedRelease, GitTagBasedReleaseConfig };
