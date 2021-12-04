# GithubNpmPackageStrategy

A [Strategy](../strategy.md) to publish NPM packages source controlled in Github.

This strategy will:

* Create a Git tag named after the next version using [GitTagCommand](../commands/git-tag-command.md)
* Switch to a temporary branch using [GitSwitchBranchCommand](../commands/git-switch-branch-command.md)
* Generate a changelog and store it into a file using [FileWriterCommand](../commands/file-writer-command.md)
* Bump the package.json version property to the next version using [NpmBumpPackageVersionCommand](../commands/npm-bump-package-version-command.md)
* Commit the generated changelog using [GitCommitCommand](../commands/git-commit-command.md)
* Push changelog changes using [GitPushBranchCommand](../commands/git-push-branch-command.md)
* Switch to back to the initial branch using [GitSwitchBranchCommand](../commands/git-switch-branch-command.md)
* Create a Github pull request to merge release changes using [GithubCreatePullRequestCommand](../commands/github-create-pull-request-command.md)
* Create a Github release using [GithubCreateReleaseCommand](../commands/github-create-release-command.md)
* Comment on Github issues mentioned in the the release commits using [GithubCreateIssueCommentsCommand](../commands/github-create-issue-comments-command.md)
* Publish the package to an npm registry using [NpmPublishPackageCommand](../commands/npm-publish-package-command.md)

![demo](../assets/github-npm-strategy-fail-demo.gif)

### Options

Type: `object literal`

###### Optional properties are denoted by *

#### logger*

Type: [Logger](../ports/logger.md)  
Default: [processStdoutLogger](../adapters/process-stdout-logger.md)

#### release

Type: [Release](../ports/release.md)  

#### remote*

Type: `string`  
Default: `origin`

#### gitClient*

Type: [GitClient](../ports/git-client.md)  
Default: [GitExecaClient](../adapters/git-execa-client.md)

#### gitActor*

Type: `string`  
Default: `undefined`

A short-hand to perform git commits using a specific author & committer email and name.

Example:

```js
/*
 * The value must be in author format: "NAME <EMAIL>"
 */
{ gitActor: "bot <bot@email.com>" }
```

```
It is also possible to explicitly use the equivalent environment variables:

GIT_COMMITTER_NAME: bot
GIT_COMMITTER_EMAIL: bot@email.com
GIT_AUTHOR_NAME: bot
GIT_AUTHOR_EMAIL: bot@email.com
```

#### workingDirectory*

Type: `string`  
Default: `process.cwd()`

#### packageRoot*

Type: `string`  
Default: `options.workingDirectory`

The working directory to use for npm commands.

#### changelogFilePath*

Type: `string`  
Default: `${workingDirectory}/CHANGELOG.md`

#### regenerateChangelog*

Type: `boolean`  
Default: `true`

Regenerate the changelog (next and previous versions).

#### github

Type: `object literal`  

An object literal with 3 properties:  

```js
{
  owner: "abstracter-io",
  repo: "atomic-release",
  personalAccessToken: "Github personal access token with repository access"
}
```

#### branchConfig

Type: `object literal`  

```js
{
  // config for "main" branch
  main: {
    isStableGithubRelease: true // Will not mark the created Github release as "pre release"
    npmRegistryDistTag: "latest" // <-- will enable doing: npm install @abstracter/atomic-release ("latest" is the default when installing)
  }

  // config for "beta" branch
  beta: {
    isStableGithubRelease: false, // Will mark the created Github release as "pre release" (falsy by default)
    npmRegistryDistTag: "unstable" // <-- will enable doing: npm install @abstracter/atomic-release@unstable
  }
}
```

### Example

```js
const { GithubNpmPackageStrategy } = require("@abstracter/atomic-release/strategies");
const { gitSemanticRelease } = require("@abstracter/atomic-release/adapters/git-semantic-release");

const github = {
  owner: "abstracter-io",
  repo: "atomic-release",
  host: "https://github.com",
};

const stableBranchName = "main";

const createRelease = () => {
  return gitSemanticRelease({
    stableBranchName,

    workingDirectory: process.cwd(),

    preReleaseBranches: {
      beta: "beta",
    },

    conventionalChangelogWriterContext: {
      host: github.host,
      owner: github.owner,
      repository: github.repo,
      repoUrl: `${github.host}//${github.owner}/${github.repo}`,
    },
  });
};

const createStrategy = (release) => {
  return new GithubNpmPackageStrategy({
    release,

    remote: "origin",

    changelogFilePath: `${process.cwd()}/CHANGELOG.md`,

    workingDirectory: process.cwd(),

    regenerateChangeLog: true,

    github: {
      repo: github.repo,
      owner: github.owner,
      personalAccessToken: process.env.GITHUB_PAT_TOKEN,
    },

    branchConfig: {
      [stableBranchName]: {
        isStable: true,
        npmRegistryDistTag: "latest",
      },

      beta: {
        npmRegistryDistTag: "beta",
      },
    },
  });
};

createRelease().then(createStrategy).then((strategy => strategy.run()));
```


