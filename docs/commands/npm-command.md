# NpmCommand

An abstract class with a method to read a package.json.

### Options

This class accpets the same options as [ExecaCommand](execa-command.md)

### Example

```js
const { NpmCommand } = require("@abstracter/atomic-release/commands");

class ExampleNpmCommand extends NpmCommand {
  async do() {
    console.log(await this.getPackageJson());
  }
  
  async undo() {
    // ...
  }
}
```
