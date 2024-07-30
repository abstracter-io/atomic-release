# NpmCommand

An abstract class with a method to read a package.json.

### Config

This class accepts the same options as [ExecaCommand](execa-command.md)

### Example

```js
const { Commands } = require("@abstracter/atomic-release");

class ExampleNpmCommand extends Commands.NpmCommand {
  async do() {
    console.log(await this.getPackageJson());
  }
  
  async undo() {
    // ...
  }
}
```
