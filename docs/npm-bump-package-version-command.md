# NpmBumpPackageVersionCommand

A command that updates the version property in a `package.json` file.

### Config

Type: `object literal`

###### Optional properties are denoted by *

##### version

Type: `string`  

##### preReleaseId

Type: `string`

> :information_source: &nbsp; [ExecaCommand](execa-command.md) options are also applicable.

### Example

```js
const { Commands } = require("@abstracter/atomic-release");

const command = new Commands.NpmBumpPackageVersionCommand({
  version: "1.0.0",
  preReleaseId: "beta",
  workingDirectory: "/absolute/path", <-- package.json should be inside
});
```
