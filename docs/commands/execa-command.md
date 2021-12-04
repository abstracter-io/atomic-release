# ExecaCommand

An abstract class with a method to execute a subprocess using [execa](https://github.com/sindresorhus/execa).

### Options

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
const { ExecaCommand } = require("@abstracter/atomic-release/commands");

class B extends ExecCommand {
  async do() {
    await this.execa("mv", ["a", "b"]);
  }
  
  async undo() {
    await this.execa("mv", ["b", "a"]);
  }
}
```
