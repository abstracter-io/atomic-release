# GitSwitchCommand

A git command that [switches](https://git-scm.com/docs/git-switch) to a desired branch.

> This command will create a branch in case it does not exist.

### Config

Type: `object literal`

###### Optional properties are denoted by *

##### branchName

Type: `string`  
Default: `undefined`

The branch name to switch to.

> :information_source: &nbsp; [ExecCommand](./exec-command.md) options are also applicable.

### Example

```js
const { Commands } = require("@abstracter/atomic-release");

const command = new Commands.GitSwitchBranchCommand({
  branchName: "some-branch-name",
});
```
