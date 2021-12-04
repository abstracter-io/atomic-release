import * as SDK from "../";
import * as Commands from "../commands";
import { Logger } from "../ports/logger";
import { Memoize, memoize } from "../utils/memoize";
import { GitStrategy, GitStrategyOptions } from "./git-strategy";
import { processStdoutLogger } from "../adapters/process-stdout-logger";

type BranchConfig = {
  isStableGithubRelease?: boolean;
  npmRegistryDistTag: string;
};

type GithubNpmPackageStrategyOptions = GitStrategyOptions & {
  remote?: string;

  gitActor?: string;

  packageRoot?: string;

  workingDirectory?: string;

  changelogFilePath?: string;

  regenerateChangelog?: boolean;

  github: {
    repo: string;
    owner: string;
    personalAccessToken: string;
  };

  branchConfig: {
    [branchName: string]: BranchConfig;
  };
};

class GithubNpmPackageStrategy extends GitStrategy<GithubNpmPackageStrategyOptions> {
  private readonly commandsLogger: Logger = processStdoutLogger({ name: this.getName() });

  private readonly remote: string;
  private readonly memoize: Memoize;
  private readonly packageRoot: string;
  private readonly workingDirectory: string;
  private readonly changelogFilePath: string;

  public constructor(options: GithubNpmPackageStrategyOptions) {
    super(options);

    this.memoize = memoize();

    this.remote = options.remote ?? "origin";
    this.workingDirectory = options.workingDirectory ?? process.cwd();
    this.packageRoot = options.packageRoot ?? this.workingDirectory;
    this.changelogFilePath = options.changelogFilePath ?? `${this.workingDirectory}/CHANGELOG.md`;
  }

  private async getBranchName(): Promise<string> {
    return this.memoize("branch_name", async () => {
      return this.gitClient.refName("HEAD");
    });
  }

  private async getTempBranchName(): Promise<string> {
    return this.options.release.getNextVersion();
  }

  private async getNextVersionTagName(): Promise<string> {
    return `v${await this.options.release.getNextVersion()}`;
  }

  private async getBranchConfig(): Promise<BranchConfig> {
    const branchName = await this.getBranchName();
    const branchConfig = this.options.branchConfig[branchName];

    if (branchConfig) {
      return branchConfig;
    }

    throw new Error(`Branch '${branchName}' is missing config`);
  }

  private async getNpmDistTag(): Promise<string | undefined> {
    const branch = await this.getBranchConfig();

    if (branch.npmRegistryDistTag) {
      return branch.npmRegistryDistTag;
    }

    throw new Error(`registry dist tag is missing`);
  }

  protected async tagOptions(): Promise<Commands.GitTagCommandOptions> {
    const prefixedVersion = await this.getNextVersionTagName();

    return {
      workingDirectory: this.workingDirectory,
      logger: this.commandsLogger,
      name: prefixedVersion,
      remote: this.remote,
    };
  }

  protected async commitOptions(): Promise<Commands.GitCommitCommandOptions> {
    const nextVersion = await this.options.release.getNextVersion();

    return {
      logger: this.commandsLogger,
      actor: this.options.gitActor,
      workingDirectory: this.workingDirectory,
      commitMessage: `docs(changelog): Adding version ${nextVersion} change log`,
      filePaths: new Set([this.changelogFilePath]),
    };
  }

  protected async pushOptions(): Promise<Commands.GitPushBranchCommandOptions> {
    const tempBranchName = await this.getTempBranchName();

    return {
      remote: this.remote,
      logger: this.commandsLogger,
      branchName: tempBranchName,
      failWhenRemoteBranchExists: true,
      workingDirectory: this.workingDirectory,
    };
  }

  protected async writeChangelogOptions(): Promise<Commands.FileWriterCommandOptions | null> {
    const changelogs: Promise<string | null>[] = [this.options.release.getChangelog()];
    const regenerate = this.options.regenerateChangelog ?? true;

    if (regenerate) {
      const versions = await this.options.release.getVersions();

      versions.forEach((version) => {
        changelogs.push(this.options.release.getChangelogByVersion(version));
      });
    }

    const changelog = await Promise.all(changelogs).then((versions) => {
      return versions.filter(Boolean).join("\n");
    });

    if (changelog !== "") {
      return {
        create: true,
        content: changelog,
        logger: this.commandsLogger,
        mode: regenerate ? "replace" : "prepend",
        absoluteFilePath: this.changelogFilePath,
      };
    }

    return null;
  }

  protected async npmPublishOptions(): Promise<Commands.NpmPublishPackageCommandOptions> {
    const npmDistTag = await this.getNpmDistTag();

    return {
      tag: npmDistTag,
      logger: this.commandsLogger,
      workingDirectory: this.packageRoot,
    };
  }

  protected async switchToTempBranchOptions(): Promise<Commands.GitSwitchCommandOptions> {
    return {
      logger: this.commandsLogger,
      branchName: await this.getTempBranchName(),
      workingDirectory: this.workingDirectory,
    };
  }

  protected async switchToInitialBranchOptions(): Promise<Commands.GitSwitchCommandOptions> {
    return {
      logger: this.commandsLogger,
      branchName: await this.getBranchName(),
      workingDirectory: this.workingDirectory,
    };
  }

  protected async createGithubReleaseOptions(): Promise<Commands.GithubCreateReleaseCommandOptions> {
    const branchConfig = await this.getBranchConfig();
    const changelog = await this.options.release.getChangelog();
    const nextVersionTagName = await this.getNextVersionTagName();

    // Create a github release without a changelog?
    return {
      body: changelog ?? undefined,
      logger: this.commandsLogger,
      name: nextVersionTagName,
      isStable: branchConfig.isStableGithubRelease === true,
      tagName: nextVersionTagName,
      repo: this.options.github.repo,
      owner: this.options.github.owner,
      headers: {
        Authorization: `token ${this.options.github.personalAccessToken}`,
      },
    };
  }

  protected async npmBumpVersionOptions(): Promise<Commands.NpmBumpPackageVersionCommandOptions> {
    const nextVersion = await this.options.release.getNextVersion();

    return {
      logger: this.commandsLogger,
      version: nextVersion,
      workingDirectory: this.packageRoot,
    };
  }

  protected async createGithubPullRequestOptions(): Promise<Commands.GithubCreatePullRequestCommandOptions> {
    const branchName = await this.getBranchName();
    const tempBranchName = await this.getTempBranchName();
    const nextVersion = await this.options.release.getNextVersion();

    return {
      base: branchName,
      head: tempBranchName,
      logger: this.commandsLogger,
      repo: this.options.github.repo,
      owner: this.options.github.owner,
      title: `Adding files affected by version ${nextVersion} release`,
      headers: {
        Authorization: `token ${this.options.github.personalAccessToken}`,
      },
    };
  }

  protected async githubIssueCommentsOptions(): Promise<Commands.GithubCreateIssueCommentsCommandOptions> {
    const { github } = this.options;
    const issues = await this.options.release.getMentionedIssues();
    const nextVersionTagName = await this.getNextVersionTagName();
    const releaseURL = `https://github.com/${github.owner}/${github.repo}/releases/tag/${nextVersionTagName}`;
    const comments: Commands.GithubCreateIssueCommentsCommandOptions["issueComments"] = [];

    for (const issue of issues) {
      const issueNumber = parseInt(issue, 10);

      if (!isNaN(issueNumber)) {
        comments.push({
          issueNumber,

          commentBody: `:mailbox: &nbsp; This issue was mentioned in release [${nextVersionTagName}](${releaseURL})`,
        });
      }
    }

    return {
      logger: this.commandsLogger,
      issueComments: comments,
      repo: this.options.github.repo,
      owner: this.options.github.owner,
      headers: {
        Authorization: `token ${this.options.github.personalAccessToken}`,
      },
    };
  }

  protected override async shouldRun(): Promise<boolean> {
    const shouldRun = await super.shouldRun();

    if (shouldRun) {
      const nextVersion = await this.options.release.getNextVersion();
      const prevVersion = await this.options.release.getPreviousVersion();

      return prevVersion !== nextVersion;
    }

    return false;
  }

  protected async getCommands(): Promise<SDK.Command[]> {
    const commands: SDK.Command[] = [];
    const writeChangelogOptions = await this.writeChangelogOptions();

    commands.push(new Commands.GitTagCommand(await this.tagOptions()));

    commands.push(new Commands.GitSwitchBranchCommand(await this.switchToTempBranchOptions()));

    if (writeChangelogOptions) {
      commands.push(new Commands.FileWriterCommand(writeChangelogOptions));
    }

    commands.push(new Commands.NpmBumpPackageVersionCommand(await this.npmBumpVersionOptions()));

    commands.push(new Commands.GitCommitCommand(await this.commitOptions()));

    commands.push(new Commands.GitPushBranchCommand(await this.pushOptions()));

    commands.push(new Commands.GitSwitchBranchCommand(await this.switchToInitialBranchOptions()));

    commands.push(new Commands.GithubCreatePullRequestCommand(await this.createGithubPullRequestOptions()));

    commands.push(new Commands.GithubCreateReleaseCommand(await this.createGithubReleaseOptions()));

    commands.push(new Commands.GithubCreateIssueCommentsCommand(await this.githubIssueCommentsOptions()));

    commands.push(new Commands.NpmPublishPackageCommand(await this.npmPublishOptions()));

    return commands;
  }
}

export { GithubNpmPackageStrategy, GithubNpmPackageStrategyOptions };
