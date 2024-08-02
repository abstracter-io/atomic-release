# Atomic Release

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-blue.svg)](http://commitizen.github.io/cz-cli/)
[![js-standard-style](https://img.shields.io/badge/code_style-standard-blue.svg?style=flat)](https://github.com/feross/standard)
[![npm latest version](https://img.shields.io/npm/v/@abstracter/atomic-release/latest.svg?color=009688)](https://www.npmjs.com/package/@abstracter/atomic-release)

Atomic Release is an SDK to help automate a software release process with the ability to "undo" steps taken when a release process fails.

## Highlights

- TypeScript friendly.
- A super simple SDK with loosely coupled APIs. Use just what you need.
- Can be used with any project type (just need a node runtime).
- A strategy for releasing npm packages: (bumping versions, generating changelogs, and much more)

  ![github-npm-strategy-demo](docs/github-npm-strategy-fail-demo.gif)
  
  A failure during a release undoes previous commands

Find out more by reading the [docs](docs)

> 💡 &nbsp; Fun fact: This library is released using githubNpmPackageStrategy. [See example](scripts/atomic-release.js)

## Install

**Prerequisites**: [Node.js](https://nodejs.org/)

> npm install --save-dev @abstracter/atomic-release

## Documentation

- [Logger](docs/logger.md)
  - [processStdoutLogger](docs/process-stdout-logger.md)
- [Strategy](docs/strategy.md)
  - [githubNpmPackageStrategy](docs/github-npm-package-strategy.md)
- [Release](docs/release.md)
  - [gitTrunkRelease](docs/git-trunk-release.md)
  - [gitTagBasedRelease](docs/git-tag-based-release.md)
- [GitClient](docs/git-client.md)
  - [GitExecClient](docs/git-exec-client.md)
- [Command](docs/command.md)
  - [ExecCommand](docs/exec-command.md)
  - [HttpCommand](docs/http-command.md)
  - [FileWriterCommand](docs/file-writer-command.md)
  - [GitCommitCommand](docs/git-commit-command.md)
  - [GitSwitchBranchCommand](docs/git-switch-branch-command.md)
  - [GitPushBranchCommand](docs/git-push-branch-command.md)
  - [GitTagCommand](docs/git-tag-command.md)
  - [GithubHttpCommand](docs/github-http-command.md)
  - [GithubCreateIssueCommentsCommand](docs/github-create-issue-comments-command.md)
  - [GithubCreatePullRequestCommand](docs/github-create-pull-request-command.md)
  - [GithubCreateReleaseCommand](docs/github-create-release-command.md)
  - [NpmCommand](docs/npm-command.md)
  - [NpmBumpPackageVersionCommand](docs/npm-bump-package-version-command.md)
  - [NpmPublishPackageCommand](docs/npm-publish-package-command.md)

## FAQ
 * Where is package-lock.json?  
   Read this [blog post](https://www.twilio.com/blog/lockfiles-nodejs) by Twilio learn more.

 * Do I have to use TypeScript to use this SDK?  
   No you don't.
