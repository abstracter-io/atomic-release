# NpmBumpPackageVersionCommand

A command that updates the version property in a `package.json` file.

### Options

Type: `object literal`

###### Optional properties are denoted by *

##### version

Type: `string`  

##### preReleaseId

Type: `string`

> :information_source: &nbsp; [ExecaCommand](execa-command.md) options are also applicable.

### Example

```js
const { NpmBumpPackageVersionCommand } = require("@abstracter/atomic-release/commands");

const command = new NpmBumpPackageVersionCommand({
  version: "1.0.0",
  preReleaseId: "beta",
  workingDirectory: "/absolute/path", <-- package.json should be inside
});
```
