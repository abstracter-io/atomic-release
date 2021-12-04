# Atomic Release

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-blue.svg)](http://commitizen.github.io/cz-cli/)
[![js-standard-style](https://img.shields.io/badge/code_style-standard-blue.svg?style=flat)](https://github.com/feross/standard)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-blue.svg?style=flat)](https://github.com/prettier/prettier)
[![npm latest version](https://img.shields.io/npm/v/@abstracter/atomic-release/latest.svg?color=009688)](https://www.npmjs.com/package/@abstracter/atomic-release)

Atomic Release is an SDK to help automate your release process and "undo" steps taken when a release fails.

## Highlights

- TypeScript friendly.
- A super simple SDK with loosely coupled APIs. Use just what you need.
- Can be used with any project type (just need a node runtime).
- A strategy for releasing npm packages: (bumping versions, generating changelogs, and much more)

  ![github-npm-strategy-demo](docs/assets/github-npm-strategy-fail-demo.gif)
  
  A failure during a release undoes previous commands

Find out more by reading the [docs](docs)

> 💡 &nbsp; Did you know? This library is released using [GithubNpmPackageStrategy](scripts/atomic-release.js) 🐓 🥚

## Install

**Prerequisites**: [Node.js](https://nodejs.org/)

> npm install --save-dev @abstracter/atomic-release

## Documentation

- SDK
   - [Command](docs/command.md)
   - [Strategy](docs/strategy.md)
- Ports
   - [Release](docs/ports/release.md)
   - [GitClient](docs/ports/git-client.md)
   - [Logger](docs/ports/logger.md)
 - Adapters
   - [gitSemanticRelease](docs/adapters/git-semantic-release.md)
   - [processStdoutLogger](docs/adapters/process-stdout-logger.md)
   - [GitExecaClient](docs/adapters/git-execa-client.md)
- Strategies
   - [GithubNpmPackageStrategy](docs/strategies/github-npm-package-strategy.md)
- Commands
   - [ExecaCommand](docs/commands/execa-command.md)
   - [HttpCommand](docs/commands/http-command.md)
   - [FileWriterCommand](docs/commands/file-writer-command.md)
   - [GitCommitCommand](docs/commands/git-commit-command.md)
   - [GitSwitchBranchCommand](docs/commands/git-switch-branch-command.md)
   - [GitPushBranchCommand](docs/commands/git-push-branch-command.md)
   - [GitTagCommand](docs/commands/git-tag-command.md)
   - [GithubHttpCommand](docs/commands/github-http-command.md)
   - [GithubCreateIssueCommentsCommand](docs/commands/github-create-issue-comments-command.md)
   - [GithubCreatePullRequestCommand](docs/commands/github-create-pull-request-command.md)
   - [GithubCreateReleaseCommand](docs/commands/github-create-release-command.md)
   - [NpmCommand](docs/commands/npm-command.md)
   - [NpmBumpPackageVersionCommand](docs/commands/npm-bump-package-version-command.md)
   - [NpmPublishPackageCommand](docs/commands/npm-publish-package-command.md)

## FAQ
 * Where is package-lock.json?  
   Read this [blog post](https://www.twilio.com/blog/lockfiles-nodejs) by Twilio learn more.

 * Do I have to use TypeScript to use this SDK?  
   No you don't.
