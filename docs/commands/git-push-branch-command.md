# GitPushBranchCommand

A git command to push a local branch to a git remote.

### Options

Type: `object literal`

###### Optional properties are denoted by *

##### remote*

Type: `string`  
Default: `origin`

##### branchName

Type: `string`

##### failWhenRemoteBranchExists

Type: `string`  
Default: `true`

> :information_source: &nbsp; [ExecaCommand](execa-command.md) options are also applicable.

### Example

```js
const { GitPushBranchCommand } = require("@abstracter/atomic-release/commands");

const command = new GitPushBranchCommand({
  remote: "custom-remote",
  branchName: "v123-generated-files",
  failWhenRemoteBranchExists: false,
});
```
