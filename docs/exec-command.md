# ExecaCommand

An abstract class with a method to create a child process using `node:child_process` module.

### Config

Type: `object literal`

###### Optional properties are denoted by *

##### silent*

Type: `boolean`  
Default: `true`

Whether to output a subprocess stdout / stderr (useful for debuging)

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
