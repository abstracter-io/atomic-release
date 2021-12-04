# GitExecaClient

An implemention of the SDK [GitClient](../ports/git-client.md) interface using [execa](https://github.com/sindresorhus/execa).

### Options

###### Optional properties are denoted by *

Type: `object literal`

##### remote*

Type: `string`  
Default: `origin`

##### workingDirectory*

Type: `string`  
Default: `process.cwd()`

### Example

```js
const { GitExecaClient } = require("@abstracter/atomic-release/adapters/git-execa-client");

const gitClient = new GitExecaClient({ remote: "origin2", workingDirectory: "/some/absolute/path" });
```
