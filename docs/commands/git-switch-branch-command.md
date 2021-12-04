# GitSwitchCommand

A git command that [switches](https://git-scm.com/docs/git-switch) to a desired branch.

> This command will create a branch in case it does not exist.

### Options

Type: `object literal`

###### Optional properties are denoted by *

##### branchName

Type: `string`  
Default: `undefined`

The branch name to switch to.

> :information_source: &nbsp; [ExecaCommand](execa-command.md) options are also applicable.

### Example

```js
const { GitSwitchBranchCommand } = require("@abstracter/atomic-release/commands");

const command = new GitSwitchBranchCommand({
  branchName: "some-branch-name",
});
```
