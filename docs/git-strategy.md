# GitStrategy

An extension of [Strategy](./strategy.md) to be used with Git.

This strategy enhances the run conditions and runs when
a branch name is defined as a release branch, and, the local & remote hash match.

### Config

Type: `object literal`

###### Optional properties are denoted by *

#### releaseBranchNames*

Type: `Set`  
Default: `new Set([main, beta, alpha])`

Specifies the branches where the strategy will run.

#### gitClient*

Type: [GitClient](./git-client.md)  
Default: [GitExecaClient](./git-execa-client.md)

The default client uses the process current working directory and a git remote called `origin`

[Strategy](./strategy.md) options are also applicable.

---

See [githubNpmPackageStrategy](./github-npm-package-strategy.md) for a reference implementation
