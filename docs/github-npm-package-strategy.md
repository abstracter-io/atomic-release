# githubNpmPackageStrategy

A [Strategy](./strategy.md) to publish NPM packages source controlled in GitHub.

This strategy will:

> Some of the below commands will not be used when config `syncRemote` is `false`

* Generate a changelog and prepend it to the changelog file using [FileWriterCommand](./file-writer-command.md)
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

#### syncRemote*
Type: `boolean`  
Default: `false`

This flag controls whether to commit and push the package.json  
and, in case `maintainChangelog` is true, the changelog file as well.

Enabling this when the remote branch is protected will require a bypass.  
See [discussions/25305](https://github.com/orgs/community/discussions/25305)

#### stableBranchName*
Type: `string`  
Default: `main`

When the branch name is equal to configured value the published npm dist tag is latest.  
Additionally. this determines the GitHub `prerelease` flag. See ["Create a release"](https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28#create-a-release)

#### logger*

Type: [Logger](./logger.md)  
Default: [processStdoutLogger](./process-stdout-logger.md)

#### release*

Type: [Release](./release.md)  
Default: [git-tag-based-release](./git-tag-based-release.md)

#### gitRemote*

Type: `string`  
Default: `origin`

#### maintainChangelog*
Type: `boolean`  
Default: `false`

#### gitActor*

Type: `string`  
Default: `process.env.RELEASE_ACTOR`

A shorthand to perform Git commits using a specific author & committer email and name.

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

#### githubPersonalAccessToken*

Type: `string`  
Default: `process.env.GITHUB_PAT_TOKEN`

The token to use when interacting with GitHub REST API  

[GitStrategy](git-strategy.md) options are also applicable.

### Example

```js
const { SDK } = require("@abstracter/atomic-release");

SDK.githubNpmPackageStrategy().then(strategy => strategy.run());
```


