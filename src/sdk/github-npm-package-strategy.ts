import path from 'node:path';
import { memo } from 'radash';
import parseGitHubURL from 'parse-github-url';
import { readPackageUp } from 'read-package-up';

import { Logger } from "./logger";
import { Release } from "./release";
import { GitClient } from "./git-client";
import { GitStrategy } from "./git-strategy";
import { GitExecClient } from "./git-exec-client";
import { gitTagBasedRelease } from "./git-tag-based-release";
import { processStdoutLogger } from "./process-stdout-logger";

import * as Commands from "../commands";

type GithubNpmPackageStrategyConfig = {
  logger?: Logger;
  release?: Release;
  gitActor?: string;
  gitRemote?: string;
  gitClient?: GitClient;
  workingDirectory?: string;
  changelogFilePath?: string;
  releaseBranchNames?: Set<string>;
  githubPersonalAccessToken?: string;
};

const createRelease = async () => {
  const githubUrl = await getParsedGitHubURL();

  return gitTagBasedRelease({
    preReleaseBranches: {
      beta: 'beta',
      alpha: 'alpha',
    },

    conventionalChangelogWriterContext: {
      host: `https://${githubUrl.host}`,
      owner: githubUrl.repoOwner,
      repoUrl: githubUrl.httpsURL,
      repository: githubUrl.repoName,
    },
  });
};

const getPackageJson = memo(async () => {
  const pkg = await readPackageUp();

  if (pkg) {
    return {
      packageJson: pkg.packageJson,
      folderPath: path.dirname(pkg.path)
    };
  }

  throw new Error('could not find package.json');
});

const getParsedGitHubURL = memo(async () => {
  const { packageJson } = await getPackageJson();
  const url = packageJson.repository?.url;

  if (url) {
    const parsed = parseGitHubURL(url);

    return {
      host: parsed.host,
      repoName: parsed.name,
      repoOwner: parsed.owner,
      httpsURL: `https://${parsed.host}/${parsed.owner}/${parsed.name}`,
    };
  }

  throw new Error('repo url is missing');
});

const githubNpmPackageStrategy = async (config: GithubNpmPackageStrategyConfig = {}) => {
  const pkg = await getPackageJson();
  const strategy = new GitStrategy({
    ...config,
    logger: config.logger ?? processStdoutLogger({ name: 'GithubNpmPackageStrategy' }),
    release: config.release ?? await createRelease(),
    gitActor: config.gitActor ?? process.env.RELEASE_ACTOR,
    gitClient: config.gitClient ?? new GitExecClient(), // TODO: This should be wrapped by a cache?
    gitRemote: config.gitRemote ?? 'origin',
    workingDirectory: config.workingDirectory ?? process.cwd(),
    changelogFilePath: config.changelogFilePath ?? `${pkg.folderPath}/CHANGELOG.md`,
    releaseBranchNames: config.releaseBranchNames ?? new Set(['main', 'beta', 'alpha']),
    githubPersonalAccessToken: config.githubPersonalAccessToken ?? process.env.GITHUB_PAT_TOKEN,
  })

  strategy.addCommandProvider(async (config) => {
    const changelogs = [config.release.getChangelog()];
    const changelog = await Promise.all(changelogs).then((versions) => {
      return versions.filter(Boolean).join("\n");
    });

    if (changelog !== "") {
      return new Commands.FileWriterCommand({
        create: true,
        content: changelog,
        logger: config.logger,
        mode: "prepend",
        absoluteFilePath: config.changelogFilePath,
      });
    }

    return null;
  });

  strategy.addCommandProvider(async (config) => {
    const [changelog, branchName, tagName] = await Promise.all([
      config.release.getChangelog(),
      config.gitClient.refName("HEAD"),
      config.release.getNextVersion().then(name => `v${name}`),
    ]);

    // When a changelog is missing we should fail? is it even possible?
    // Perhaps compress the build folder and upload it as an asset? (use pkg.files)
    return new Commands.GithubCreateReleaseCommand({
      body: changelog ?? undefined,
      logger: config.logger,
      name: tagName,
      isStable: branchName === 'main',
      tagName: tagName,
      repo: 'test',
      owner: 'elad',
      headers: {
        Authorization: `token ${config.githubPersonalAccessToken}`,
      },
    });
  });

  strategy.addCommandProvider(async (config) => {
    const githubUrl = await getParsedGitHubURL();
    const [issues, versionName] = await Promise.all([
      config.release.getMentionedIssues(),
      config.release.getNextVersion().then(name => `v${name}`)
    ]);
    const releaseURL = `${githubUrl.httpsURL}/releases/tag/${versionName}`;
    const comments: Array<{ issueNumber: number, commentBody: string }> = [];

    for (const issue of issues) {
      const issueNumber = parseInt(issue, 10);

      if (!isNaN(issueNumber)) {
        comments.push({
          issueNumber,

          commentBody: `:mailbox: &nbsp; This issue was mentioned in release [${versionName}](${releaseURL})`,
        });
      }
    }

    return new Commands.GithubCreateIssueCommentsCommand({
      logger: config.logger,
      repoName: githubUrl.repoName,
      repoOwner: githubUrl.repoOwner,
      issueComments: comments,
      headers: {
        Authorization: `token ${config.githubPersonalAccessToken}`,
      },
    });
  });

  strategy.addCommandProvider(async (config) => {
    const nextVersion = await config.release.getNextVersion();

    return new Commands.NpmBumpPackageVersionCommand({
      logger: config.logger,
      version: nextVersion,
      workingDirectory: config.workingDirectory,
    });
  });

  strategy.addCommandProvider(async (config) => {
    const versionName = `v${await config.release.getNextVersion()}`;

    return new Commands.GitTagCommand({
      name: versionName,
      logger: config.logger,
      remote: config.gitRemote,
      workingDirectory: config.workingDirectory,
    });
  });

  strategy.addCommandProvider(async (config) => {
    const nextVersion = await config.release.getNextVersion();

    return new Commands.GitCommitCommand({
      actor: config.gitActor,
      logger: config.logger,
      workingDirectory: config.workingDirectory,
      commitMessage: `chore: release version ${nextVersion}`,
      filePaths: new Set([
        'package.json',
        config.changelogFilePath,
      ]),
    });
  });

  strategy.addCommandProvider(async (config) => {
    const branchName = await config.gitClient.refName("HEAD");

    return new Commands.GitPushBranchCommand({
      logger: config.logger,
      remote: config.gitRemote,
      branchName: branchName,
      workingDirectory: config.workingDirectory,
      failWhenRemoteBranchExists: false,
    });
  });

  strategy.addCommandProvider(async (config) => {
    const branchName = await config.gitClient.refName("HEAD");
    const distTag = branchName === 'main' ? 'latest' : branchName;

    return new Commands.NpmPublishPackageCommand({
      tag: distTag,
      logger: config.logger,
      workingDirectory: config.workingDirectory,
    });
  });

  return strategy;
};

export { githubNpmPackageStrategy };

export type { GithubNpmPackageStrategyConfig }
