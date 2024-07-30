# githubNpmPackageStrategy

A [Strategy](./strategy.md) to publish NPM packages source controlled in GitHub.

This strategy will:

* Generate a changelog and store it prepend it to a file using [FileWriterCommand](./file-writer-command.md)
* Create a GitHub release using [GithubCreateReleaseCommand](./github-create-release-command.md)
* Comment on GitHub issues mentioned in the release commits using [GithubCreateIssueCommentsCommand](./github-create-issue-comments-command.md)
* Bump the package.json version property to the next version using [NpmBumpPackageVersionCommand](./npm-bump-package-version-command.md) 
* Create a Git tag named after the next version using [GitTagCommand](./git-tag-command.md)
* Commit the generated changelog & changed package.json using [GitCommitCommand](./git-commit-command.md)
* Push the commit using [GitPushBranchCommand](./git-push-branch-command.md)
* Publish the package to the npm registry using [NpmPublishPackageCommand](./npm-publish-package-command.md)

![demo](./github-npm-strategy-fail-demo.gif)

### Config

Type: `object literal`

###### Optional properties are denoted by *

#### logger*

Type: [Logger](./logger.md)  
Default: [processStdoutLogger](./process-stdout-logger.md)

#### release*

Type: [Release](./release.md)  
Default: [git-tag-based-release](./git-tag-based-release.md)

#### gitRemote*

Type: `string`  
Default: `origin`

#### gitClient*

Type: [GitClient](./git-client.md)  
Default: [GitExecaClient](./git-execa-client.md)

#### gitActor*

Type: `string`  
Default: `process.env.RELEASE_ACTOR`

A shorthand to perform git commits using a specific author & committer email and name.

Example:

```js
/*
 * The value must be in author format: "NAME <EMAIL>"
 */
{ gitActor: "bot <bot@email.com>" }

// It is also possible to explicitly use the equivalent environment variables:
//
// GIT_COMMITTER_NAME: bot
// GIT_COMMITTER_EMAIL: bot@email.com
// GIT_AUTHOR_NAME: bot
// GIT_AUTHOR_EMAIL: bot@email.com
```

#### workingDirectory*

Type: `string`  
Default: `process.cwd()`

#### changelogFilePath*

Type: `string`  
Default: `${workingDirectory}/CHANGELOG.md`

#### releaseBranchNames*

Type: `Set`  
Default: `new Set([main, beta, alpha])`

Specifies the branches where the strategy will run.

#### githubPersonalAccessToken*

Type: `string`  
Default: `process.env.GITHUB_PAT_TOKEN`

The token to use when interacting with GitHub REST API  

> ℹ️ &nbsp; [GitStrategy](git-strategy.md) options are also applicable.

### Example

```js
const { SDK } = require("@abstracter/atomic-release");

SDK.githubNpmPackageStrategy().then(strategy => strategy.run());
```


