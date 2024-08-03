# ExecaCommand

An abstract class with a method to create a child process using `node:child_process` module.

### Config

Type: `object literal`

###### Optional properties are denoted by *

##### logStd*

Type: `boolean`  
Default: `false`

Whether to output the child process stdout / stderr (useful for debugging)

##### workingDirectory

Type: `string`

### Example

```js
const { Commands } = require("@abstracter/atomic-release");

class MoveCommand extends Commands.ExecCommand {
  async do() {
    await this.execa("mv", ["a", "b"]);
  }
  
  async undo() {
    await this.execa("mv", ["b", "a"]);
  }
}
```

> TIP: To log stdout & stderr regardless of the used `logStd` config  
> an environment variable with CSV can be set:  
> process.env.EXEC_COMMAND_LOG_STD='GitTagCommand,GitPushBranchCommand'
