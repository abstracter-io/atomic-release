# GitPushBranchCommand

A git command to push a local branch to a git remote.

### Config

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

> :information_source: &nbsp; [ExecCommand](./exec-command.md) options are also applicable.

### Example

```js
const { Commands } = require("@abstracter/atomic-release");

const command = new Commands.GitPushBranchCommand({
  remote: "custom-remote",
  branchName: "v123-generated-files",
  failWhenRemoteBranchExists: false,
});
```
