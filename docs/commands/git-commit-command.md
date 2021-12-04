# GitCommitCommand

A git command that stages and commits files in a working tree.

### Options

Type: `object literal`

###### Optional properties are denoted by *

##### actor*

Type: `string`
Default: `undefined`

A short-hand to perform the commit using a specific author & committer email and name.

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

##### commitMessage

Type: `string`

##### filePaths

Type: `Set`

> :information_source: &nbsp; [ExecaCommand](execa-command.md) options are also applicable.

### Example

```js
const { GitCommitCommand } = require("@abstracter/atomic-release/commands");

const command = new GitCommitCommand({
  actor: "bot <bot@mailbox.io>",
  commitMessage: "ci: adding files generated during CI/CD",
  workingDirectory: "/home/rick.sanchez/my-awesome-node-project",
  filePaths: new Set(["path/relative/to/working/directory/file.txt"]),
});
```
