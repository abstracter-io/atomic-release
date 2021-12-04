# GitStrategy

A basic [Strategy](../strategy.md) to be used with Git.

### Options

Type: `object literal`

###### Optional properties are denoted by *

#### logger*

Type: [Logger](../ports/logger.md)  
Default: [processStdoutLogger](../adapters/process-stdout-logger.md)

#### isReleaseBranch*

Type: `function`

A callback which will be invoked with the current branch name, and returns a boolean indiciting  
whether this is a release branch (`true`) or not (`false`).

The default callback always returns `true`.

#### gitClient*

Type: [GitClient](../ports/git-client.md)  
Default: [GitExecaClient](../adapters/git-execa-client.md)

The default client uses the process current working directory and a git remote called `origin`

---

See [GithubNpmPackageStrategy](github-npm-package-strategy.md) for a reference implementation
